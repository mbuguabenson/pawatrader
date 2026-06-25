# App ID Switching System - Complete Implementation Guide

## Overview

This system automatically switches between two Deriv API app IDs after trades complete, using a 2:1 pattern:

- **App ID 111045** takes **2 trades** before switching
- **App ID 111298** takes **1 trade** before switching
- Pattern repeats: `111045 → 111045 → 111298 → 111045 → 111045 → 111298...`

The switching is **silent** (no page refresh, no interruption to trades) and uses localStorage to persist state.

---

## How It Works

1. **Trade Detection**: Listens for trade completion events (`contract.status` and `bot.contract`)
2. **Count Tracking**: Tracks how many trades each app ID has processed
3. **Automatic Switching**: Switches app ID when the count threshold is reached
4. **State Persistence**: Uses localStorage to remember current app ID and trade count
5. **Debounce Protection**: Prevents duplicate processing of the same trade

---

## Complete Code Implementation

### Part 1: Configuration File (`config.ts`)

```typescript
// ============================================
// APP ID SWITCHING CONFIGURATION
// ============================================

// Define your two app IDs
const APP_ID_1 = 111045; // Takes 2 trades
const APP_ID_2 = 111298; // Takes 1 trade

// localStorage keys for state management
const CURRENT_APP_ID_KEY = 'current_trading_app_id';
const TRADE_COUNT_KEY = 'current_app_id_trade_count';
const LAST_TRADE_TIME_KEY = 'last_trade_processed_time';

// Debounce settings (prevents duplicate processing)
const TRADE_DEBOUNCE_MS = 3000; // 3 seconds between trade processing

// Flag to prevent concurrent processing
let isProcessingSwitch = false;

/**
 * Switches app ID based on pattern: 111045 takes 2 trades, then 111298 takes 1 trade
 * Pattern: 111045 → 111045 → 111298 → 111045 → 111045 → 111298 (repeats)
 */
export const switchAppIdAfterTrade = () => {
    // Prevent concurrent processing
    if (isProcessingSwitch) {
        return null;
    }

    // Check debounce - prevent processing same trade multiple times
    const lastTradeTime = parseInt(localStorage.getItem(LAST_TRADE_TIME_KEY) || '0', 10);
    const now = Date.now();
    if (now - lastTradeTime < TRADE_DEBOUNCE_MS) {
        return null;
    }

    isProcessingSwitch = true;

    try {
        // Update last trade time immediately to prevent duplicate processing
        localStorage.setItem(LAST_TRADE_TIME_KEY, now.toString());

        // Read current state from localStorage
        const currentAppId = parseInt(localStorage.getItem(CURRENT_APP_ID_KEY) || APP_ID_1.toString(), 10);
        let tradeCount = parseInt(localStorage.getItem(TRADE_COUNT_KEY) || '0', 10);

        // Increment trade count for current app ID
        tradeCount += 1;

        let newAppId = currentAppId;

        // Pattern logic:
        // - APP_ID_1 (111045) takes 2 trades before switching
        // - APP_ID_2 (111298) takes 1 trade before switching
        if (currentAppId === APP_ID_1) {
            if (tradeCount >= 2) {
                // 111045 has taken 2 trades, switch to 111298
                newAppId = APP_ID_2;
                tradeCount = 0; // Reset count for new app ID
            }
        } else if (currentAppId === APP_ID_2) {
            if (tradeCount >= 1) {
                // 111298 has taken 1 trade, switch to 111045
                newAppId = APP_ID_1;
                tradeCount = 0; // Reset count for new app ID
            }
        }

        // Update localStorage IMMEDIATELY to prevent race conditions
        localStorage.setItem(CURRENT_APP_ID_KEY, newAppId.toString());
        localStorage.setItem(TRADE_COUNT_KEY, tradeCount.toString());
        window.localStorage.setItem('config.app_id', newAppId.toString());

        isProcessingSwitch = false;
        return newAppId;
    } catch (error) {
        isProcessingSwitch = false;
        return null;
    }
};

/**
 * Initialize app ID system on app startup
 * Call this once when your app loads
 */
export const forceUpdateAppId = () => {
    // Initialize with APP_ID_1 if not set
    if (!localStorage.getItem(CURRENT_APP_ID_KEY)) {
        localStorage.setItem(CURRENT_APP_ID_KEY, APP_ID_1.toString());
        localStorage.setItem(TRADE_COUNT_KEY, '0');
    }

    // Initialize trade count if not set
    if (!localStorage.getItem(TRADE_COUNT_KEY)) {
        localStorage.setItem(TRADE_COUNT_KEY, '0');
    }

    const currentAppId = parseInt(localStorage.getItem(CURRENT_APP_ID_KEY) || APP_ID_1.toString(), 10);
    window.localStorage.setItem('config.app_id', currentAppId.toString());

    return currentAppId;
};

/**
 * Get the current app ID to use for API connections
 * This should be called when establishing WebSocket connections
 */
export const getAppId = () => {
    // For production, use the current trading app ID
    const currentTradingAppId = localStorage.getItem(CURRENT_APP_ID_KEY);
    if (currentTradingAppId) {
        const appId = parseInt(currentTradingAppId, 10);
        window.localStorage.setItem('config.app_id', appId.toString());
        return appId;
    }

    // Fallback to APP_ID_1 if not set
    const defaultAppId = APP_ID_1;
    localStorage.setItem(CURRENT_APP_ID_KEY, defaultAppId.toString());
    localStorage.setItem(TRADE_COUNT_KEY, '0');
    window.localStorage.setItem('config.app_id', defaultAppId.toString());
    return defaultAppId;
};
```

---

### Part 2: Event Listeners Setup (`App.tsx` or main component)

```typescript
import { forceUpdateAppId, switchAppIdAfterTrade } from '@/components/shared/utils/config/config';
import { observer as globalObserver } from '@/external/bot-skeleton/utils/observer';

// In your main App component's useEffect:
React.useEffect(() => {
    // Initialize app ID system
    forceUpdateAppId();

    // Debounce mechanism to prevent multiple switches from the same trade
    let lastSwitchTime = 0;
    const SWITCH_DEBOUNCE_MS = 2000; // Only allow one switch per 2 seconds

    const triggerAppIdSwitch = () => {
        const now = Date.now();
        if (now - lastSwitchTime < SWITCH_DEBOUNCE_MS) {
            return;
        }
        lastSwitchTime = now;
        setTimeout(() => {
            switchAppIdAfterTrade();
        }, 500); // Small delay to ensure trade is fully processed
    };

    // Listen for trade completion to switch app ID after each trade
    // Handler for contract status changes
    const contractStatusHandler = (contractStatus: any) => {
        try {
            // Handle both string and object formats
            let isSold = false;

            if (typeof contractStatus === 'string') {
                // String format: 'purchase.sold' from Sell.js
                isSold = contractStatus === 'purchase.sold';
            } else if (contractStatus && typeof contractStatus === 'object') {
                // Object format: { id: 'contract.sold', ... } from OpenContract.js
                isSold = contractStatus.id === 'contract.sold' || contractStatus.id === 'purchase.sold';
            }

            if (isSold) {
                triggerAppIdSwitch();
            }
        } catch (error) {
            // Silent error handling
        }
    };

    // Handler for bot contract updates
    const botContractHandler = (contract: any) => {
        try {
            const isSold =
                contract && (contract.is_sold === true || contract.is_sold === 1 || contract.status === 'sold');

            if (isSold) {
                triggerAppIdSwitch();
            }
        } catch (error) {
            // Silent error handling
        }
    };

    // Register handlers with a function that re-registers them if they get unregistered
    const registerAppIdSwitchHandlers = () => {
        globalObserver.register('contract.status', contractStatusHandler);
        globalObserver.register('bot.contract', botContractHandler);
    };

    // Initial registration
    registerAppIdSwitchHandlers();

    // Re-register handlers periodically to ensure they persist even if unregistered by other code
    const reRegisterInterval = setInterval(() => {
        if (!globalObserver.isRegistered('contract.status') || !globalObserver.isRegistered('bot.contract')) {
            registerAppIdSwitchHandlers();
        }
    }, 1000); // Check every second

    // Store the original emit function
    const originalEmit = globalObserver.emit.bind(globalObserver);

    // Replace emit to ensure handlers are called
    globalObserver.emit = function (event: string, data: any) {
        if (event === 'contract.status' || event === 'bot.contract') {
            // Re-register handlers if they're missing
            if (!globalObserver.isRegistered(event)) {
                registerAppIdSwitchHandlers();
            }
        }

        // Call the original emit which will trigger all registered handlers normally
        return originalEmit.call(globalObserver, event, data);
    };

    // Cleanup on unmount
    return () => {
        clearInterval(reRegisterInterval);
    };
}, []);
```

---

### Part 3: WebSocket Connection Setup

When establishing WebSocket connections, use `getAppId()` to get the current app ID:

```typescript
import { getAppId } from '@/components/shared/utils/config/config';

export const generateDerivApiInstance = () => {
    const appId = getAppId(); // This will return the current app ID (111045 or 111298)
    const socket_url = `wss://ws.derivws.com/websockets/v3?app_id=${appId}&l=EN&brand=deriv`;

    const deriv_socket = new WebSocket(socket_url);
    // ... rest of your WebSocket setup
};
```

---

## Step-by-Step Explanation

### 1. **Initialization** (`forceUpdateAppId`)

- Called once when app starts
- Sets initial app ID to `111045` if not already set
- Initializes trade count to `0`
- Stores values in localStorage

### 2. **Trade Detection**

- Two event handlers listen for trade completion:
    - `contract.status` - Fires when contract status changes
    - `bot.contract` - Fires when bot contract updates
- Both check if trade is sold/completed
- When sold, triggers `triggerAppIdSwitch()`

### 3. **Debounce Protection**

- `triggerAppIdSwitch()` has a 2-second debounce
- Prevents multiple calls for the same trade
- Adds 500ms delay to ensure trade is fully processed

### 4. **App ID Switching Logic** (`switchAppIdAfterTrade`)

- Reads current app ID and trade count from localStorage
- Increments trade count by 1
- Checks if threshold reached:
    - If `111045` and count >= 2 → switch to `111298`
    - If `111298` and count >= 1 → switch to `111045`
- Resets count to 0 when switching
- Updates localStorage immediately

### 5. **State Persistence**

- All state stored in localStorage:
    - `current_trading_app_id` - Current app ID (111045 or 111298)
    - `current_app_id_trade_count` - Number of trades with current app ID
    - `last_trade_processed_time` - Timestamp of last processed trade (for debounce)
    - `config.app_id` - Used by your app for WebSocket connections

### 6. **Handler Persistence**

- Handlers are re-registered every second if they get unregistered
- `globalObserver.emit` is intercepted to ensure handlers are always active
- Prevents other code from accidentally removing the handlers

---

## Configuration Options

### Change the Pattern Ratio

To change from 2:1 to a different ratio (e.g., 3:1 or 1:1):

```typescript
// For 3:1 pattern (111045 takes 3 trades, 111298 takes 1)
if (currentAppId === APP_ID_1) {
    if (tradeCount >= 3) {
        // Changed from 2 to 3
        newAppId = APP_ID_2;
        tradeCount = 0;
    }
}

// For 1:1 pattern (alternating every trade)
if (currentAppId === APP_ID_1) {
    if (tradeCount >= 1) {
        // Changed from 2 to 1
        newAppId = APP_ID_2;
        tradeCount = 0;
    }
}
```

### Change App IDs

```typescript
const APP_ID_1 = 111045; // Your first app ID
const APP_ID_2 = 111298; // Your second app ID
```

### Adjust Debounce Timing

```typescript
const TRADE_DEBOUNCE_MS = 3000; // Increase for slower trades, decrease for faster
const SWITCH_DEBOUNCE_MS = 2000; // In App.tsx triggerAppIdSwitch
```

---

## Integration Checklist

1. ✅ Copy `switchAppIdAfterTrade()` function to your config file
2. ✅ Copy `forceUpdateAppId()` function to your config file
3. ✅ Copy `getAppId()` function to your config file
4. ✅ Update `getAppId()` to use the switching logic (read from `CURRENT_APP_ID_KEY`)
5. ✅ Add event listeners setup in your main App component
6. ✅ Call `forceUpdateAppId()` on app initialization
7. ✅ Use `getAppId()` when creating WebSocket connections
8. ✅ Test with a few trades to verify the pattern works

---

## Important Notes

- **No Page Refresh**: The switching happens silently in localStorage. New WebSocket connections will use the new app ID.
- **Existing Connections**: Current WebSocket connections continue with the old app ID until they naturally reconnect.
- **State Persistence**: All state is stored in localStorage, so it persists across page refreshes.
- **Silent Operation**: No console logs or user notifications by default.
- **Error Handling**: All errors are silently caught to prevent breaking the app.

---

## Testing

To verify it's working:

1. Open browser DevTools → Application → Local Storage
2. Check these keys:
    - `current_trading_app_id` - Should show 111045 or 111298
    - `current_app_id_trade_count` - Should increment with each trade
3. Make trades and watch the values change
4. After 2 trades with 111045, it should switch to 111298
5. After 1 trade with 111298, it should switch back to 111045

---

## Troubleshooting

**Issue**: App ID not switching

- Check if event handlers are registered: `globalObserver.isRegistered('contract.status')`
- Verify trades are completing (check `is_sold` or `status === 'sold'`)
- Check localStorage for current values

**Issue**: Switching too frequently

- Increase `TRADE_DEBOUNCE_MS` or `SWITCH_DEBOUNCE_MS`
- Check if multiple events are firing for same trade

**Issue**: State not persisting

- Verify localStorage is enabled in browser
- Check for localStorage errors in console
- Ensure keys are being set correctly

---

## Complete File Structure

```
src/
├── components/
│   └── shared/
│       └── utils/
│           └── config/
│               └── config.ts          (Part 1: Switching logic)
└── app/
    └── App.tsx                         (Part 2: Event listeners)
```

---

## Summary

This system provides:

- ✅ Automatic app ID switching after trades
- ✅ Customizable pattern (currently 2:1)
- ✅ Silent operation (no interruptions)
- ✅ State persistence (survives page refreshes)
- ✅ Debounce protection (prevents duplicates)
- ✅ Handler persistence (always active)

The code is production-ready and can be directly integrated into any Deriv bot application.
