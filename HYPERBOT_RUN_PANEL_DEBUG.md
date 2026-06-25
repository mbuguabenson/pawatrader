# Hyperbot Run Panel Integration - Debug Guide

## Testing if Messages are Being Received

Open your browser console on the main app and run this to test if the message handler is working:

```javascript
// Simulate a trade event from Hyperbot
window.postMessage(
    {
        type: 'TRADE_PLACED',
        contract_id: 'test-contract-' + Date.now(),
        transaction_id: 123456789,
        buy_price: 0.5,
        currency: 'USD',
        contract_type: 'DIGITUNDER',
        underlying: 'R_10',
        display_name: 'Volatility 10 Index',
        date_start: Math.floor(Date.now() / 1000),
        status: 'open',
    },
    '*'
);
```

You should see in the console:

- `📨 [Hyperbot] Received message from iframe: TRADE_PLACED`
- `📊 [Hyperbot] Received trade event from iframe:`
- `📝 [Hyperbot] Calling onBotContractEvent with:`
- `✅ [Hyperbot] Added trade to Run Panel:`

## What to Check in Your Hyperbot Iframe

1. **Verify messages are being sent**: In your Hyperbot iframe console, after placing a trade, you should see the postMessage being sent.

2. **Message format**: Make sure you're sending exactly this format:

```javascript
if (window.parent && window.parent !== window) {
    window.parent.postMessage(
        {
            type: 'TRADE_PLACED', // Must be exactly this
            contract_id: buy.contract_id, // Required
            transaction_id: buy.transaction_id, // Required
            buy_price: buy.buy_price, // Required
            currency: 'USD', // Required
            contract_type: 'DIGITUNDER', // Required
            underlying: 'R_10', // Required
            display_name: 'Volatility 10 Index', // Required
            date_start: Math.floor(Date.now() / 1000), // Required
            status: 'open', // Required
        },
        '*'
    );
}
```

3. **Check parent window access**: Make sure `window.parent !== window` (you're in an iframe)

4. **Check console logs**: Look for any errors in both parent and iframe consoles

## Common Issues

1. **Messages not received**:
    - Check if iframe is cross-origin (different domain)
    - Verify `window.parent` exists
    - Check browser console for CORS errors

2. **Transactions not showing**:
    - Verify `contract_id` is a valid string/number
    - Check that `transaction_id` is provided
    - Ensure `run_id` is set (should happen automatically on first trade)

3. **Run Panel not opening**:
    - Check if `run_panel` store is available
    - Verify `toggleDrawer` is being called
    - Check if Run Panel is hidden by CSS

## Debug Steps

1. Open browser DevTools on the main app
2. Go to Console tab
3. Place a trade in Hyperbot iframe
4. Look for these log messages:
    - `📨 [Hyperbot] Received message from iframe:`
    - `📊 [Hyperbot] Received trade event from iframe:`
    - `🚀 [Hyperbot] Initialized run panel with run_id:`
    - `📝 [Hyperbot] Calling onBotContractEvent with:`
    - `✅ [Hyperbot] Added trade to Run Panel:`
    - `🔍 [Hyperbot] Current transactions count:`

5. If you don't see these messages, the iframe is not sending messages correctly
6. If you see the messages but transactions don't appear, check the transaction store

## Manual Test from Console

Run this in the main app console to manually add a test transaction:

```javascript
const store = window.__DERIV_STORE__;
if (store && store.transactions) {
    store.transactions.onBotContractEvent({
        contract_id: 'test-' + Date.now(),
        transaction_ids: { buy: 999999999 },
        buy_price: 0.5,
        currency: 'USD',
        contract_type: 'DIGITUNDER',
        underlying: 'R_10',
        display_name: 'Volatility 10 Index',
        date_start: Math.floor(Date.now() / 1000),
        status: 'open',
    });
    console.log('Test transaction added. Check Run Panel.');
} else {
    console.error('Store not available');
}
```
