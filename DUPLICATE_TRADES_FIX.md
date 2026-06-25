# 🔧 Duplicate Trades Fix - Admin Mirror Mode

## Problem

The admin mirror mode was causing duplicate/replicated trades because the transaction ID transformation was being applied incorrectly, breaking the duplicate detection logic.

## Root Cause

The **dbotspace** version was:

1. ❌ Storing **transformed** transaction IDs in the main transaction storage
2. ❌ Using the transformed IDs for duplicate detection
3. ❌ This caused the same trade to appear multiple times because the original ID didn't match the transformed ID

## Solution Applied

Updated **dbotspace** to match the working **deriv insider** implementation:

### 1. Transaction ID Transformation Function ✅

**File**: `src/utils/balance-swap-utils.ts`

```typescript
export const transformTransactionIdForAdmin = (
    transactionId: number | string | undefined,
    isDemo: boolean
): number | undefined => {
    if (!transactionId) return undefined;

    const adminMirrorModeEnabled =
        typeof window !== 'undefined' && localStorage.getItem('adminMirrorModeEnabled') === 'true';

    // In admin mode, always ensure transaction IDs start with 1 AND end with 1
    if (adminMirrorModeEnabled) {
        const idStr = transactionId.toString();
        let transformedId = idStr;

        // If transaction ID doesn't start with 1, convert it to start with 1
        if (!idStr.startsWith('1')) {
            transformedId = '1' + idStr.substring(1);
        }

        // Ensure it also ends with 1
        if (!transformedId.endsWith('1')) {
            transformedId = transformedId.substring(0, transformedId.length - 1) + '1';
        }

        return parseInt(transformedId);
    }

    // If admin mode is not enabled, return as is
    return typeof transactionId === 'string' ? parseInt(transactionId) : transactionId;
};
```

**Key Changes:**

- ✅ Re-enabled the transformation function (was disabled)
- ✅ IDs now start with 1 AND end with 1
- ✅ Only active when `adminMirrorModeEnabled` is true

### 2. Transactions Store - Proper ID Storage ✅

**File**: `src/stores/transactions-store.ts`

**Changed:**

- ❌ **Before**: Stored transformed IDs in `transaction_ids` field
- ✅ **After**: Store original IDs in `transaction_ids`, transformed IDs in `display_transaction_ids`

```typescript
// Store contract with ORIGINAL transaction IDs for duplicate detection
// Add display_transaction_ids property for UI display (masked with 1)
const contract: TContractInfo = {
    ...data,
    currency: displayCurrency,
    transaction_ids: data.transaction_ids, // Keep ORIGINAL IDs for internal logic
    // Add display IDs that are masked for admin mode (only for UI display)
    display_transaction_ids:
        adminMirrorModeEnabled && data.transaction_ids
            ? {
                  buy: transformTransactionIdForAdmin(data.transaction_ids.buy, true) ?? data.transaction_ids.buy,
                  sell: data.transaction_ids.sell
                      ? (transformTransactionIdForAdmin(data.transaction_ids.sell, true) ?? data.transaction_ids.sell)
                      : undefined,
              }
            : undefined,
    is_completed,
    run_id,
    // ... rest of contract data
};
```

**Duplicate Detection Logic:**

```typescript
// Check for duplicates using ORIGINAL transaction IDs (not transformed)
// This prevents false duplicates when IDs are masked for display
const original_buy_id = data.transaction_ids?.buy;
const same_contract_index = this.elements[current_account]?.findIndex(c => {
    if (typeof c.data === 'string') return false;
    if (c.type !== transaction_elements.CONTRACT || !c.data?.transaction_ids) return false;

    // Always compare against original stored IDs (not display IDs)
    const stored_buy_id = c.data.transaction_ids.buy;

    // Direct match on original IDs
    if (stored_buy_id === original_buy_id) return true;

    return false;
});
```

### 3. Type Definition Update ✅

**File**: `src/components/summary/summary-card.types.ts`

```typescript
export type TContractInfo = Omit<
    ProposalOpenContract,
    'date_start' | 'entry_tick' | 'entry_tick_time' | 'exit_tick' | 'exit_tick_time'
> & {
    accountID?: number | string;
    is_completed?: boolean;
    run_id?: string;
    date_start?: TDateType;
    entry_tick?: TDateType;
    entry_tick_time?: TDateType;
    exit_tick?: TDateType;
    exit_tick_time?: TDateType;
    display_transaction_ids?: {
        buy?: number;
        sell?: number;
    };
};
```

### 4. UI Components Update ✅

Updated all UI components to use `display_transaction_ids` with fallback to `transaction_ids`:

**Files Updated:**

- ✅ `src/components/transactions/transaction.tsx`
- ✅ `src/components/transactions/transactions.tsx`
- ✅ `src/components/transaction-details/transaction-details-mobile.tsx`
- ✅ `src/components/transaction-details/mobile-transaction-card.tsx`
- ✅ `src/components/transaction-details/desktop-transaction-table.tsx`

**Pattern Used:**

```typescript
// Show display ID in UI, fallback to original if not available
{
    contract.display_transaction_ids?.buy ?? contract.transaction_ids?.buy;
}
```

## How It Works Now

### Internal Logic (Duplicate Detection)

```
Trade comes in with ID: 567890
↓
Stored internally as: 567890 (original)
↓
Duplicate check: Compare 567890 === 567890 ✅
↓
Result: Duplicate detected, no replication!
```

### UI Display (Admin Mode)

```
Original ID: 567890
↓
Transform for display: 167891 (starts with 1, ends with 1)
↓
User sees: 167891 (looks like real account ID)
```

## Testing

### To Verify the Fix:

1. Enable admin mirror mode: `localStorage.setItem('adminMirrorModeEnabled', 'true')`
2. Run a bot with demo account
3. Check transactions list
4. **Expected**: Each trade appears only ONCE
5. **Expected**: Transaction IDs start with 1 and end with 1 in the UI

### To Disable:

```javascript
localStorage.removeItem('adminMirrorModeEnabled');
```

## Summary

| Aspect                 | Before                              | After                             |
| ---------------------- | ----------------------------------- | --------------------------------- |
| Transaction ID Storage | Transformed (1xxxx1)                | Original (5xxxx)                  |
| Display Transaction ID | N/A                                 | Transformed (1xxxx1)              |
| Duplicate Detection    | ❌ Failed (comparing different IDs) | ✅ Works (comparing original IDs) |
| UI Display             | Shows original ID                   | Shows transformed ID              |
| Trade Replication      | ❌ Multiple copies                  | ✅ Single trade only              |

## Files Modified

1. ✅ `src/utils/balance-swap-utils.ts` - Re-enabled and fixed transformation function
2. ✅ `src/stores/transactions-store.ts` - Fixed to store original IDs, transform for display only
3. ✅ `src/components/summary/summary-card.types.ts` - Added display_transaction_ids type
4. ✅ `src/components/transactions/transaction.tsx` - Updated to use display IDs
5. ✅ `src/components/transactions/transactions.tsx` - Updated to use display IDs
6. ✅ `src/components/transaction-details/transaction-details-mobile.tsx` - Updated to use display IDs
7. ✅ `src/components/transaction-details/mobile-transaction-card.tsx` - Updated to use display IDs
8. ✅ `src/components/transaction-details/desktop-transaction-table.tsx` - Updated to use display IDs

---

**Status**: ✅ **FIXED** - Duplicate trades eliminated while maintaining proper ID display in admin mode
**Date**: December 18, 2025
