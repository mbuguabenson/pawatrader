# Balance Swap Logic for Special CR Accounts

## Overview

This feature allows specific CR accounts to share balance with the demo account (VRTC). The balance calculation follows the formula:

```
CR_account_balance = Demo_balance - subtract_amount
```

## Implementation Details

### Files Created/Modified

1. **`src/utils/special-accounts-config.ts`** (NEW)
    - Contains the list of special CR accounts and their subtract amounts
    - Provides utility functions to check if an account is special
    - Configuration for accounts:
        - `CR6779123` (USD Account) - subtract: 8412.05
        - `CR9585762` (TRC20 Account) - subtract: 0 (configure as needed)
        - `CR9585763` (BTC Account) - subtract: 0 (configure as needed)
        - Other special accounts as configured

2. **`src/stores/client-store.ts`** (MODIFIED)
    - Updated `setAllAccountsBalance()` method to apply balance sharing logic
    - Updated `all_accounts_balance` computed getter to ensure special CR accounts always use shared balance
    - Logic works independently of admin mirror mode

3. **`src/external/bot-skeleton/services/tradeEngine/trade/Purchase.js`** (MODIFIED)
    - Updated `shouldUseDemoAccountForTrade()` to detect special CR accounts
    - When trading with a special CR account, automatically switches to demo account for trade execution
    - This prevents "insufficient funds" errors by using demo account balance for trades

### How It Works

1. **On Balance Update** (`setAllAccountsBalance`):
    - Gets the demo account (VRTC) balance
    - For each special CR account in the list:
        - Checks if the account exists in balance data
        - Calculates: `CR_balance = Demo_balance - subtract_amount`
        - Updates the account balance in the balance object
    - Stores the modified balance object

2. **On Balance Access** (`all_accounts_balance` getter):
    - Always applies special CR account balance sharing first
    - Then applies admin mirror mode if enabled (for non-special accounts)
    - Special CR accounts take precedence over mirror mode

### Special CR Accounts Configuration

The special accounts are defined in `src/utils/special-accounts-config.ts`:

```typescript
export const SPECIAL_CR_ACCOUNTS: SpecialAccountConfig[] = [
    {
        loginid: 'CR4940389',
        subtract: 8000.0, // Adjust this amount as needed
        description: 'Main CR Account - Shares balance with VRTC7346559 demo account',
    },
];

// Note: VRTC7346559 is the demo account (virtual account) and is automatically detected
// The system uses VRTC7346559 as the base balance for all calculations
```

### Example Calculation

If demo account (VRTC7346559) has balance: **10,000 USD**

- **CR4940389** balance = 10,000 - 8,000.00 = **2,000.00 USD**

**Note**: Adjust the `subtract` amount in the config file to change the displayed balance for CR4940389.

### Integration with Admin Section

The balance swap logic:

- ✅ Works automatically when `setAllAccountsBalance` is called (during login/balance updates)
- ✅ Works independently of admin mirror mode
- ✅ Special CR accounts always use the shared balance formula
- ✅ Non-special accounts can still use admin mirror mode if enabled
- ✅ No additional admin configuration needed - it's always active

### Debugging

In development mode, the system logs balance calculations:

```
[Balance Swap] Special CR account CR6779123: 10000 - 8412.05 = 1587.95
```

### Notes

- The subtract amounts are configurable in `special-accounts-config.ts`
- If subtract amount is 0, the account will show the full demo balance
- The logic only applies if:
    - A demo account (VRTC) exists
    - The demo account has a valid balance
    - The special CR account exists in the balance data
    - The subtract amount is greater than 0

### How Trades Work with Special CR Accounts

**Important**: When trading with a special CR account (like CR4940389):

1. **UI Display**: Shows fake balance (Demo - subtract amount)
    - Example: If demo has $10,000, CR4940389 shows $2,000

2. **Trade Execution**: Automatically uses **demo account balance** for trades
    - The system detects you're trading with a special CR account
    - It automatically switches to the demo account (VRTC7346559) for trade execution
    - This prevents "insufficient funds" errors
    - Trades are executed using the demo account's real balance

3. **Balance Updates**: After trades, balances update normally
    - Demo account balance updates based on trade results
    - CR account displayed balance recalculates: `new_demo_balance - 8000.00`

**Why This Works**:

- The UI shows a fake balance for the CR account (for display purposes)
- But trades are executed using the demo account (which has the real balance)
- This allows trading even when the CR account shows a low fake balance

### Testing

To test the balance swap:

1. Login with an account that has both demo (VRTC7346559) and special CR account (CR4940389)
2. Check the balance of CR4940389 - it should be: `VRTC7346559_balance - 8000.00`
3. Verify the calculation updates when demo balance changes
4. **Test Trading**: Place a trade with CR4940389 - it should execute successfully using demo balance
5. Check console logs in development mode for balance calculations

**Current Configuration**:

- **Demo Account**: VRTC7346559 (automatically detected as virtual account)
- **CR Account**: CR4940389 (shows fake balance: Demo - 8000.00)
- **Trade Execution**: Uses VRTC7346559 balance automatically
