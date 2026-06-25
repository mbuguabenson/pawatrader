# Special CR Accounts Setup Guide

## Overview

This system supports multiple special CR accounts that display calculated balances while trading on dedicated demo accounts. Each special CR account is configured to use its own demo account for trading.

## Architecture

```
Special CR Account (Display)
    ↓
    └─→ Calculated Balance = Demo Account Balance - Configured Subtract Amount
    ↓
Demo Account (API Trading)
    ↓
    └─→ Actual trades executed here
```

**Key Points:**

- UI displays the **special CR account** (e.g., `CR7917545`)
- API trades on the **mapped demo account** (e.g., `VRTC11729450`)
- Balance shown = `demo_balance - subtract_amount`
- Contracts appear in run panel under the special account display
- Multiple accounts are **completely independent** with their own demo accounts

## Adding a New Special Account

### Step 1: Identify Your Accounts

You need:

- **Special CR Account ID** (e.g., `CR7917545`)
- **Demo Account ID** (e.g., `VRTC11729450`)
- **Subtract Amount**: The balance offset to calculate displayed balance
    - Formula: `displayed_balance = demo_balance - subtract_amount`
    - Example: If demo has 10,000 and subtract is 2,000, display shows 8,000

### Step 2: Edit Configuration File

Open `/workspaces/dbot/src/utils/special-accounts-config.ts`

Add your account to the `SPECIAL_CR_ACCOUNTS` array:

```typescript
export const SPECIAL_CR_ACCOUNTS: SpecialAccountConfig[] = [
    // Existing accounts...
    {
        loginid: 'CR7917545',
        subtract: 9867.31,
        demoAccountId: 'VRTC11729450',
        description: 'Main CR Account - Shares balance with VRTC11729450 demo account',
    },
    {
        loginid: 'CR8095225',
        subtract: 9568.92,
        demoAccountId: 'VRTC11961900',
        description: 'Secondary CR Account - Shares balance with VRTC11961900 demo account',
    },
    // Add your new account here:
    {
        loginid: 'CR_YOUR_ACCOUNT_ID', // ← Replace with actual CR account ID
        subtract: YOUR_SUBTRACT_AMOUNT, // ← Replace with your subtract value
        demoAccountId: 'VRTC_YOUR_DEMO_ID', // ← Replace with actual demo account ID
        description: 'Description of this account',
    },
];
```

**Example:**

```typescript
{
    loginid: 'CR9999999',
    subtract: 5000.00,
    demoAccountId: 'VRTC9999999',
    description: 'Trading account with 5000 offset from demo balance',
}
```

### Step 3: Verify Configuration

The system will automatically:

- Detect the special account when user logs in as `CR9999999`
- Switch the API to trade on `VRTC9999999` when bot runs
- Display balance as `VRTC9999999_balance - 5000`
- Show all contracts in the run panel under the CR account

### Step 4: Test

1. Log in as the special CR account
2. Check that account switcher shows the special account
3. Run the bot - verify it switches to the demo account and trades
4. Check run panel - contracts should appear as completed immediately

## How It Works

### When Bot Starts (`onRunButtonClick`)

```
1. User clicks "Run"
   ↓
2. System checks if special account is active (show_as_cr in localStorage)
   ↓
3. If special account:
   - Get the mapped demo account from configuration
   - Switch API authorization to demo account
   - Verify switch succeeded
   ↓
4. Start bot trading on demo account
```

### When Contract Completes

```
1. Contract is sold on demo account
   ↓
2. `onBotContractEvent` fires
   ↓
3. For special accounts:
   - Mark contract as complete immediately
   - Display in run panel under special account name
   - Don't stop bot (allows continuous trading)
   ↓
4. Show in transactions/journal with correct details
```

## Available Helper Functions

All helper functions work with any special account (not hardcoded to specific accounts):

```typescript
import {
    isSpecialCRAccount,
    getSpecialAccountConfig,
    getDemoAccountIdForSpecialCR,
    getSubtractAmount,
} from '@/utils/special-accounts-config';

// Check if an account is special
if (isSpecialCRAccount('CR7917545')) {
    // ... handle special account
}

// Get full configuration
const config = getSpecialAccountConfig('CR7917545');
// Returns: { loginid, subtract, demoAccountId, description }

// Get the demo account to trade on
const demoId = getDemoAccountIdForSpecialCR('CR7917545');
// Returns: 'VRTC11729450'

// Get the subtract amount
const subtract = getSubtractAmount('CR7917545');
// Returns: 9867.31
```

## Key Implementation Details

### Where Special Account Logic is Used

1. **Account Switching** (`src/components/account-switcher.tsx`)
    - Shows special account balances with offset calculation

2. **Header Display** (`src/components/layout/header/header.tsx`)
    - Displays special account name in account selector

3. **Bot Run Panel** (`src/stores/run-panel-store.ts`)
    - Switches to demo account before bot starts
    - Keeps bot running after contracts close for special accounts
    - Shows contracts as complete immediately
    - Continues trading even if bot logic says to stop (for special accounts)

4. **Transactions & Journal** (`src/stores/transactions-store.ts`, `journal-store.ts`)
    - Records contracts on demo account but attributes to special account display

5. **Client Store** (`src/stores/client-store.ts`)
    - Maintains balance calculation: `demo_balance - subtract_amount`

### Contract Display Pipeline for Special Accounts

```
Contract Executed on Demo Account (VRTC11729450)
    ↓
Bot contract event fired
    ↓
onBotContractEvent() in run-panel-store.ts
    ↓
Check if special account active (show_as_cr in localStorage)
    ↓
Mark contract as complete & has_open_contract = false
    ↓
UI displays contract in run panel under special account name
    ↓
Continue bot trading (don't stop)
```

## Troubleshooting

### Contracts Not Showing in Run Panel

**Check:**

1. Is `show_as_cr` set correctly in localStorage?
    - Open DevTools → Application → Local Storage
    - Look for `show_as_cr` key
    - Should be the special CR account ID

2. Did API switch to demo account?
    - Check browser console logs
    - Look for `[Run Panel] ✅ Successfully switched to demo account`

3. Is the subtract amount correct?
    - If too large, displayed balance will be negative
    - Adjust in `SPECIAL_CR_ACCOUNTS` configuration

### Bot Not Starting

**Check:**

1. Is demo account available and has sufficient balance?
2. Are both accounts (special and demo) properly configured?
3. Check console for `[Run Panel] ❌ Failed to switch to demo account`

### Wrong Balance Displayed

**Fix:**
Update the `subtract` amount in configuration:

- If balance shows too high: increase subtract value
- If balance shows too low: decrease subtract value

Example: If demo shows 10,000 but you want to display 8,000:

```typescript
subtract: 2000; // 10,000 - 2,000 = 8,000
```

## Migration from Single to Multiple Accounts

If you previously had hardcoded account IDs:

### Before:

```typescript
const isSpecialCR = showAsCR === 'CR6779123'; // ❌ Hardcoded
```

### After:

```typescript
const isSpecialAccount = showAsCR && isSpecialCRAccount(showAsCR); // ✅ Generic
```

The system has been updated to support multiple accounts. No hardcoded references remain in the run-panel-store.

## Summary

✅ **Multiple accounts supported** - Add as many as needed  
✅ **Each account has own demo account** - Independent trading  
✅ **Automatic balance calculation** - Configured in one place  
✅ **Contracts show immediately** - No delays in UI  
✅ **Continuous trading support** - Bot keeps running for special accounts  
✅ **Generic helper functions** - Works for any special account

Simply add your account to the `SPECIAL_CR_ACCOUNTS` array and the system handles the rest!
