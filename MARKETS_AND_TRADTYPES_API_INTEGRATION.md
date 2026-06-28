# Markets and Trade Types - Current API Integration

## Overview
This document maps how markets and trade types data is currently fetched and processed in the application, relevant for OAuth PKCE flow migration.

---

## 1. MARKETS DATA FETCHING

### 1.1 Active Symbols Fetching
**File:** [src/external/bot-skeleton/services/api/api-base.ts](src/external/bot-skeleton/services/api/api-base.ts#L644-L690)

**Method:** `getActiveSymbols()`

**API Endpoint:**
```javascript
this.api?.send({ active_symbols: 'brief' })
```

**Flow:**
1. Connection check
2. Send WebSocket message requesting active symbols
3. Timeout handling (10 seconds)
4. Response processing: `{ active_symbols = [], error = {} }`
5. Symbol enrichment via `ActiveSymbolsProcessorService`

**Error Handling:**
```typescript
// Line 655-670
if (error && Object.keys(error).length > 0) {
    throw new Error(`Active symbols API error: ${error.message || 'Unknown error'}`);
}

if (!active_symbols.length) {
    throw new Error('No active symbols received from API');
}

// Fallback to raw symbols if enrichment fails
this.active_symbols = active_symbols; // (line 685)
```

**Loading State:**
- Sets: `this.has_active_symbols = true` (line 669)
- Uses: `this.active_symbols_promise` to track fetching state
- Toggle button: `this.toggleRunButton(false)` on success

---

### 1.2 Trading Times Fetching
**File:** [src/components/shared/services/trading-times-service.ts](src/components/shared/services/trading-times-service.ts#L47-L103)

**Method:** `getTradingTimes()`

**API Endpoint:**
```javascript
api_base.api.send({ trading_times: new Date().toISOString().split('T')[0] })
// Example: { trading_times: "2026-06-28" }
```

**Response Structure:**
```typescript
interface TradingTimesApiResponse {
    trading_times?: {
        markets: Array<{
            name: string;
            submarkets?: Array<{
                name: string;
                symbols?: Array<{
                    symbol: string;
                    display_name: string;
                }>;
            }>;
        }>;
    };
    error?: {
        message?: string;
        code?: string;
    };
}
```

**Caching:**
- Cache duration: 5 minutes
- Cache key: `this.trading_times_cache`
- Returns cached data if: `now < this.cache_expiry && this.trading_times_cache.markets`

**Error Handling:**
```typescript
// Lines 99-103
if (!trading_times?.markets || !Array.isArray(trading_times.markets)) {
    throw new Error('Invalid trading times data structure received from API');
}

// Timeout: 10 seconds (line 39: FETCH_TIMEOUT_MS)
```

---

### 1.3 Active Symbols Processing
**File:** [src/services/active-symbols-processor.service.ts](src/services/active-symbols-processor.service.ts#L76-L405)

**Class:** `ActiveSymbolsProcessorService`

**Main Method:** `processActiveSymbols(activeSymbols: ActiveSymbolInput[])`

**Processing Pipeline:**
1. Extract pip sizes: `processPipSizes()`
2. Enrich with trading times: `enrichActiveSymbolsWithTradingTimes()`
3. Return: `{ enrichedSymbols, pipSizes }`

**Error Handling with Fallback:**
```typescript
// Lines 138-140 - When trading times fail
console.warn('Failed to create lookup maps from trading times, using fallback mappings:', error);
// Falls back to basic market mappings from common data

// Lines 364-367 - During enrichment
catch (error) {
    console.error('Error enriching active symbols:', error);
    return activeSymbols.map(symbol => ({...})); // Return with minimal processing
}
```

**Loading State:**
- Timeout: 10 seconds for enrichment (`ENRICHMENT_TIMEOUT_MS`)
- Promise race: `Promise.race([enrichmentPromise, enrichmentTimeout])`

---

## 2. TRADE TYPES DATA FETCHING

### 2.1 Contracts For (Trade Types)
**File:** [src/external/bot-skeleton/services/api/contracts-for.js](src/external/bot-skeleton/services/api/contracts-for.js#L184-L240)

**API Endpoint:**
```javascript
api_base.api.send({ contracts_for: symbol })
// Example: { contracts_for: "EURUSD" }
```

**Response Structure:**
```javascript
{
    contracts_for: {
        available: [
            {
                contract_category: string,
                trade_type: string,
                expiry_type: 'intraday' | 'tick',
                barrier: number,
                high_barrier: number,
                low_barrier: number,
                // ... other properties
            },
            // ... more contracts
        ]
    }
}
```

**Cache Management:**
```javascript
// Line 8
this.contracts_for = {}; // Symbol -> contracts mapping

// Line 194-196 - Cache check
if (this.retrieving_contracts_for[symbol]) {
    await this.retrieving_contracts_for[symbol];
    return this.contracts_for[symbol].contracts;
}

// Line 224-225 - Age check (10 min cache)
if (this.contracts_for[symbol]) {
    const { contracts, timestamp } = this.contracts_for[symbol];
    // Check if age_in_min >= 10
}
```

**Singleton Pattern:**
```javascript
// Line 199 - Promise tracking
this.retrieving_contracts_for[symbol] = new PendingPromise();

// Lines 218-219 - Cleanup
this.retrieving_contracts_for[symbol].resolve();
delete this.retrieving_contracts_for[symbol];
```

---

### 2.2 Trade Type Queries
**File:** [src/pages/bot-builder/quick-strategy/selects/trade-type.tsx](src/pages/bot-builder/quick-strategy/selects/trade-type.tsx#L43-L56)

**Usage Pattern:**
```typescript
const { contracts_for } = (ApiHelpers?.instance as unknown as TApiHelpersInstance) ?? {};

const trade_types = await contracts_for?.getTradeTypesForQuickStrategy?.(
    symbol,
    market,
    submarket
);
```

**Related Methods:**
- `getTradeTypesForQuickStrategy(tradetype)` - Gets trade types for strategy
- `getContractTypes(tradetype)` - Gets contract type categories
- `getDurations(symbol, tradetype)` - Gets available durations

---

## 3. API ENDPOINTS SUMMARY

| Endpoint | Purpose | Parameters | Response Type |
|----------|---------|-----------|---------------|
| `active_symbols` | Fetch available trading symbols | `{ active_symbols: 'brief' }` | Array of symbols with market/submarket info |
| `trading_times` | Fetch market hours and open status | `{ trading_times: 'YYYY-MM-DD' }` | Market structure with times |
| `contracts_for` | Fetch available trade types for symbol | `{ contracts_for: 'SYMBOL' }` | Contract availability and barriers |
| `authorize` | User authentication | `{ authorize: token }` | Account info, balance, etc. |

---

## 4. SERVICE FILES INVOLVED

| File | Purpose | Key Methods |
|------|---------|-----------|
| [api-base.ts](src/external/bot-skeleton/services/api/api-base.ts) | WebSocket connection & main API orchestration | `getActiveSymbols()`, `authorizeAndSubscribe()` |
| [trading-times-service.ts](src/components/shared/services/trading-times-service.ts) | Trading times caching & fetching | `getTradingTimes()`, `clearCache()` |
| [active-symbols-processor.service.ts](src/services/active-symbols-processor.service.ts) | Symbol enrichment & processing | `processActiveSymbols()`, `enrichActiveSymbolsWithTradingTimes()` |
| [contracts-for.js](src/external/bot-skeleton/services/api/contracts-for.js) | Trade types caching | `getContractsByTradeType()`, `getDurations()` |
| [active-symbols.js](src/external/bot-skeleton/services/api/active-symbols.js) | Legacy active symbols integration | `retrieveActiveSymbols()` |
| [trading-times.js](src/external/bot-skeleton/services/api/trading-times.js) | Legacy trading times (deprecated in TS) | `updateTradingTimes()` |

---

## 5. ERROR HANDLING & LOADING STATES

### 5.1 Timeouts
- **Active Symbols**: 10 seconds (`ACTIVE_SYMBOLS_TIMEOUT_MS`)
- **Trading Times**: 10 seconds (`FETCH_TIMEOUT_MS`)
- **Symbol Enrichment**: 10 seconds (`ENRICHMENT_TIMEOUT_MS`)

### 5.2 Error Fallbacks

**Scenario 1: Trading Times Fetch Fails**
```typescript
// active-symbols-processor.service.ts line 138-141
// Falls back to basic market mappings from MARKET_MAPPINGS.MARKET_DISPLAY_NAMES
```

**Scenario 2: Symbol Enrichment Fails**
```typescript
// api-base.ts line 683-685
// Falls back to raw active symbols without enrichment
console.warn('Symbol enrichment failed, using raw symbols:', enrichmentError);
this.active_symbols = active_symbols;
```

**Scenario 3: API Error Response**
```typescript
// Checked at multiple points:
if (error && Object.keys(error).length > 0) {
    throw new Error(`API error: ${error.message || 'Unknown error'}`);
}
```

### 5.3 Loading State Tracking

**Active Symbols Loading:**
```typescript
// api-base.ts
this.active_symbols_promise: Promise<any[] | undefined> | null = null;
this.has_active_symbols = false;
```

**Trading Times Loading:**
```typescript
// trading-times-service.ts
this.cache_expiry: number = 0;
// Check: now < this.cache_expiry
```

**Contracts For Loading:**
```typescript
// contracts-for.js
this.retrieving_contracts_for = {}; // Symbol -> Promise mapping
```

---

## 6. KEY INTEGRATION POINTS FOR OAuth PKCE MIGRATION

### 6.1 Authorization Dependencies
- **Before** fetching markets/trade types: Must have `api_base.api` (WebSocket connection)
- **After** OAuth flow: Token is passed to `authorize()` method
- **Account initialization**: `authorizeAndSubscribe()` must complete before market data fetching

### 6.2 WebSocket Message Flow
```
oauth_token_exchange 
  ↓
authorize(access_token) 
  ↓ 
getActiveSymbols() [uses: this.api?.send()]
  ↓
getTradingTimes() [uses: api_base.api.send()]
  ↓
processActiveSymbols() [enrichment]
```

### 6.3 Token Usage
- **OAuth Token**: Passed to `authorize()` method
- **Active Symbols**: Public API call (no token in message)
- **Trading Times**: Public API call (no token in message)
- **Contracts For**: Public API call (no token in message)

---

## 7. CRITICAL NOTES FOR PKCE MIGRATION

1. **No inline token passing needed**: Markets/trade types APIs don't require token in the send() message
2. **Authorization must complete first**: All market data fetching depends on successful `authorize()` call
3. **Caching strategy must persist**: 
   - Trading times: 5 min cache
   - Contracts for: 10 min cache
4. **Error recovery paths**: Fallbacks to raw data when enrichment fails - ensure this works in new flow
5. **WebSocket dependency**: All these APIs require active WebSocket connection (readyState === 1)
6. **Timeout handling**: OAuth flow should respect existing timeout constants

---

## 8. FILES TO REVIEW FOR PKCE INTEGRATION

**OAuth Token Exchange:**
- [src/services/oauth-token-exchange.service.ts](src/services/oauth-token-exchange.service.ts) - See line 210 for account fetching pattern

**WebSocket Connection:**
- [src/external/bot-skeleton/services/api/api-base.ts](src/external/bot-skeleton/services/api/api-base.ts#L237-L271) - handleTokenExchangeIfNeeded()

**Account Authorization:**
- [src/app/CoreStoreProvider.tsx](src/app/CoreStoreProvider.tsx#L124-L153) - Re-authorization pattern

**Type Definitions:**
- [src/types/api-types.ts](src/types/api-types.ts) - API request/response types
