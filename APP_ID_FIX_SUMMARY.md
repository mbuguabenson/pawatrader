# App ID Switching Fix - Summary

## Problem

The app ID switching system was working (both app IDs receiving commissions correctly), but then stopped working. The issue was that once a WebSocket connection was established with an app_id, all subsequent trades used that same app_id until the connection was closed, even if the app_id had changed in localStorage.

## Solution Implemented

### 1. Track App ID Used for WebSocket Connection

**File**: `src/external/bot-skeleton/services/api/appId.js`

- Added `currentConnectionAppId` variable to track which app_id was used when creating the WebSocket connection
- Modified `generateDerivApiInstance()` to store the app_id when creating a new connection
- Added `hasAppIdChanged()` function to check if app_id has changed since connection was created

### 2. Ensure Current App ID Before Trades

**File**: `src/external/bot-skeleton/services/api/api-base.ts`

- Added `ensureCurrentAppId()` method to APIBase class
- This method checks if app_id has changed and automatically reconnects the WebSocket if needed
- This ensures each trade uses the correct app_id for commission tracking

### 3. Check App ID Before Each Trade

**File**: `src/external/bot-skeleton/services/tradeEngine/trade/Purchase.js`

- Modified both trade execution points to call `api_base.ensureCurrentAppId()` before making the trade
- This ensures the WebSocket is using the current app_id before each purchase

### 4. Force Fresh App ID Reading

**File**: `src/components/shared/utils/config/config.ts`

- Enhanced `getAppId()` to always read fresh from localStorage
- Added comments to clarify that it always reads the current trading app ID
- Ensures the browser always uses the current app_id

## How It Works Now

1. **On App Start**: `forceUpdateAppId()` initializes the app_id system
2. **On Trade Completion**: `switchAppIdAfterTrade()` updates the app_id in localStorage following the 2:1 pattern
3. **Before Each Trade**: `ensureCurrentAppId()` checks if app_id has changed
4. **If App ID Changed**: WebSocket is automatically reconnected with the new app_id
5. **Trade Execution**: Trade is made using the current app_id, ensuring correct commission tracking

## Pattern Maintained

- **App ID 111045**: Takes 2 trades before switching
- **App ID 111298**: Takes 1 trade before switching
- Pattern: `111045 → 111045 → 111298 → 111045 → 111045 → 111298...`

## Key Functions

### `ensureCurrentAppId()`

- Checks if current app_id in localStorage differs from the one used for WebSocket
- If different, automatically reconnects WebSocket with new app_id
- Called before each trade to ensure correct app_id is used

### `hasAppIdChanged()`

- Compares current app_id in localStorage with the one used for connection
- Returns true if app_id has changed and reconnection is needed

### `getAppId()`

- Always reads fresh from localStorage
- Returns the current trading app_id (111045 or 111298)
- Updates `config.app_id` in localStorage for browser compatibility

## Testing

To verify it's working:

1. Open browser DevTools → Application → Local Storage
2. Check `current_trading_app_id` - should show 111045 or 111298
3. Check `current_app_id_trade_count` - should increment with each trade
4. Make trades and watch:
    - After 2 trades with 111045, it switches to 111298
    - After 1 trade with 111298, it switches back to 111045
5. Check commission tracking - each app_id should receive commissions for its trades

## Files Modified

1. `src/external/bot-skeleton/services/api/appId.js` - Track app_id and check for changes
2. `src/external/bot-skeleton/services/api/api-base.ts` - Add ensureCurrentAppId method
3. `src/external/bot-skeleton/services/tradeEngine/trade/Purchase.js` - Check app_id before trades
4. `src/components/shared/utils/config/config.ts` - Ensure fresh app_id reading

## Result

✅ Each trade now uses the correct app_id for commission tracking
✅ App ID switches automatically after trades (2:1 pattern)
✅ WebSocket automatically reconnects when app_id changes
✅ No manual intervention needed - fully automatic
✅ State persists across page refreshes via localStorage
