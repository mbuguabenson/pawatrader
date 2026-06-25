# Iframe Bot Authentication Setup (Matches, Hyperbot, Diffbot & SpeedBot)

## Overview

The main project now loads **Matches**, **Hyperbot**, **Diffbot**, and **SpeedBot** as iframes:

- **Matches**: `https://matches-sooty.vercel.app/`
- **Hyperbot**: `https://hyperbot-indol.vercel.app/`
- **Diffbot**: `https://diffbot-nu.vercel.app/`
- **SpeedBot**: `https://speedbot-eta.vercel.app/`

The parent window sends authentication tokens via `postMessage` so the iframes can place trades and show them in the Run Panel.

## What's Already Done in Main Project

1. **Updated `src/pages/matches/index.tsx`** - Now uses `IframeWrapper` instead of direct component
2. **Updated `src/pages/hyperbot/index.tsx`** - Now uses `IframeWrapper` instead of direct component
3. **Updated `src/pages/diffbot/index.tsx`** - Now uses `IframeWrapper` instead of direct component
4. **Updated `src/pages/speedbot/index.tsx`** - Now uses `IframeWrapper` instead of direct component
5. **Enhanced `src/components/iframe-wrapper/iframe-wrapper.tsx`** - Sends auth tokens via postMessage:
    - Automatically on iframe load
    - Every 5 seconds (periodic updates)
    - Immediately when login state changes (monitors localStorage)
    - On-demand when iframe requests it (listens for `REQUEST_AUTH` messages)

## What You Need to Add to Your Bot Projects

Add this code to your **Matches**, **Hyperbot**, **Diffbot**, or **SpeedBot** project (in your main component file or a separate auth handler file) to receive and use the authentication tokens:

```javascript
// Add this useEffect hook in your Hyperbot component
useEffect(() => {
    // Listen for auth tokens from parent window
    const handleMessage = event => {
        // For security, you might want to check event.origin
        // if (event.origin !== 'https://your-main-domain.com') return;

        if (event.data && event.data.type === 'AUTH_TOKEN') {
            const { token, loginid, appId } = event.data;

            if (token && loginid) {
                // Store the token in localStorage so your existing code can use it
                localStorage.setItem('authToken', token);
                localStorage.setItem('active_loginid', loginid);

                // CRITICAL: Store the appId from parent - you MUST use this appId for WebSocket connections
                if (appId) {
                    localStorage.setItem('config.app_id', appId.toString());
                    console.log('✅ Auth token and app ID received from parent (app ID:', appId, ')');
                } else {
                    console.log('Auth token received from parent window');
                }

                // If you need to re-authorize the API, do it here
                // IMPORTANT: Make sure your API uses the appId from localStorage, not a hardcoded value
                // For example:
                // const appId = parseInt(localStorage.getItem('config.app_id') || '106168', 10);
                // if (apiRef.current) {
                //     apiRef.current.authorize(token);
                // }
            }
        }
    };

    window.addEventListener('message', handleMessage);

    // Request auth token immediately on load
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'REQUEST_AUTH' }, '*');
    }

    return () => {
        window.removeEventListener('message', handleMessage);
    };
}, []);
```

## Optional: Request Auth Token on Demand

If you want to request the auth token on demand (e.g., when user tries to place a trade), you can add:

```javascript
const requestAuthToken = () => {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'REQUEST_AUTH' }, '*');
    }
};
```

## Security Note

For production, you should validate the `event.origin` in the message handler:

```javascript
const handleMessage = event => {
    // Only accept messages from your main domain
    const allowedOrigins = ['https://your-main-domain.com', 'https://www.your-main-domain.com'];

    if (!allowedOrigins.includes(event.origin)) {
        console.warn('Rejected message from unauthorized origin:', event.origin);
        return;
    }

    // ... rest of the handler
};
```

## Sending Trade Events to Run Panel

To show trades in the parent's Run Panel (Transactions, Journal, Summary), send trade events via `postMessage`:

### When a Trade is Placed

```javascript
// After successfully placing a trade, send this message:
if (window.parent && window.parent !== window) {
    window.parent.postMessage(
        {
            type: 'TRADE_PLACED', // or 'CONTRACT_EVENT'
            contract_id: buy.contract_id,
            transaction_id: buy.transaction_id, // or buy_transaction_id
            buy_price: buy.buy_price,
            currency: account_currency, // e.g., 'USD'
            contract_type: 'DIGITMATCH', // or 'DIGITUNDER', 'DIGITOVER', 'DIGITEVEN', 'DIGITODD', 'DIGITDIFF', etc.
            underlying: symbol, // e.g., 'R_10'
            display_name: symbol_display, // e.g., 'Volatility 10 Index'
            date_start: Math.floor(Date.now() / 1000), // Unix timestamp
            status: 'open',
        },
        '*'
    );
}
```

### When a Contract Updates (completes, profit/loss changes)

```javascript
// When contract status changes:
if (window.parent && window.parent !== window) {
    window.parent.postMessage(
        {
            type: 'CONTRACT_UPDATE',
            contract_id: contract.contract_id,
            status: contract.status, // 'open', 'won', 'lost', etc.
            profit: contract.profit,
            payout: contract.payout,
            // ... other contract data
        },
        '*'
    );
}
```

### Example: Complete Trade Placement Flow

```javascript
const placeTrade = async () => {
    try {
        // Place your trade
        const buy = await api.buy({
            /* your params */
        });

        if (buy?.contract_id) {
            // Send to parent Run Panel
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(
                    {
                        type: 'TRADE_PLACED',
                        contract_id: buy.contract_id,
                        transaction_id: buy.transaction_id,
                        buy_price: buy.buy_price,
                        currency: 'USD', // or get from your account
                        contract_type: 'DIGITUNDER',
                        underlying: 'R_10',
                        display_name: 'Volatility 10 Index',
                        date_start: Math.floor(Date.now() / 1000),
                        status: 'open',
                    },
                    '*'
                );
            }

            // Subscribe to contract updates and send updates to parent
            api.subscribe({ proposal_open_contract: 1, contract_id: buy.contract_id }, response => {
                const contract = response.proposal_open_contract;
                if (contract && window.parent && window.parent !== window) {
                    window.parent.postMessage(
                        {
                            type: 'CONTRACT_UPDATE',
                            contract_id: contract.contract_id,
                            status: contract.status,
                            profit: contract.profit,
                            payout: contract.payout,
                            bid_price: contract.bid_price,
                        },
                        '*'
                    );
                }
            });
        }
    } catch (error) {
        console.error('Trade placement error:', error);
    }
};
```

## Testing

1. Open your main project and **log in**
2. Navigate to SpeedBots > Matches (or Hyperbot, Diffbot, or SpeedBot)
3. Open browser DevTools > Console (both parent and iframe)
4. **In parent console**, you should see:
    - `🚀 Initializing iframe: https://matches-sooty.vercel.app/` (or hyperbot/diffbot/speedbot URL)
    - `✅ Iframe loaded successfully`
    - `🔐 [Matches] Sent auth token to iframe (loginid: ...)` (or `[Hyperbot]`, `[Diffbot]`, `[SpeedBot]`)
    - `📊 [Matches] Received trade event from iframe:` (when you place a trade)
    - `✅ [Matches] Added trade to Run Panel:` (when trade is added)
5. **In iframe console** (inspect the iframe), you should see:
    - `Auth token received from parent window`
6. Check that `localStorage.getItem('authToken')` in the iframe contains the token
7. The "Please log in" modal should disappear
8. Try placing a trade - it should work with the shared authentication
9. **Check the Run Panel** - your trades should appear in Transactions, and statistics should update in Summary

### How to Inspect Iframe Console

1. Right-click on the iframe content
2. Select "Inspect" or "Inspect Element"
3. This opens DevTools for the iframe's context
4. Go to Console tab to see iframe logs

## CRITICAL: Using the Correct App ID

**The parent sends `appId: 106168` (or your configured app ID). You MUST use this appId when creating WebSocket connections.**

### The Problem

If you use a different app ID (like 1089) than the one the token was issued for, you'll get:

```
Authorization error: {code: 'InvalidToken', message: 'Token is not valid for current app ID.'}
```

### The Solution

1. **Store the appId** from the postMessage (shown in code above)
2. **Use that appId** when creating your WebSocket connection:

```javascript
// When creating WebSocket connection, use appId from localStorage
const appId = parseInt(localStorage.getItem('config.app_id') || '106168', 10);
const socket_url = `wss://ws.binaryws.com/websockets/v3?app_id=${appId}`;

// Or if using DerivAPIBasic:
const deriv_api = new DerivAPIBasic({
    connection: new WebSocket(socket_url),
    // ... other config
});
```

3. **Reconnect** when appId changes:

```javascript
useEffect(() => {
    const handleMessage = event => {
        if (event.data && event.data.type === 'AUTH_TOKEN') {
            const { token, loginid, appId } = event.data;

            if (appId) {
                const currentAppId = localStorage.getItem('config.app_id');
                const newAppId = appId.toString();

                // If appId changed, reconnect WebSocket
                if (currentAppId !== newAppId) {
                    localStorage.setItem('config.app_id', newAppId);
                    // Reconnect your API/WebSocket here
                    reconnectAPI(newAppId, token);
                }
            }
        }
    };
    // ... rest of code
}, []);
```

## Troubleshooting

- **"Token is not valid for current app ID"**: Your bot (Matches/Hyperbot/Diffbot/SpeedBot) is using a different app ID than the parent. Make sure you're using `localStorage.getItem('config.app_id')` when creating WebSocket connections, not a hardcoded value.
- **"AuthorizationRequired: Please log in"**: The token isn't being used correctly. Check that you're authorizing the API with the token after receiving it.
- **If trades don't work**: Check that the token is being received and stored correctly, AND that you're using the correct appId
- **If token is null**: Make sure you're logged in to the main project first
- **If iframe doesn't load**: Check CORS settings and iframe permissions
- **If postMessage doesn't work**: Verify both sites are using HTTPS (required for postMessage in some browsers)
