# Deriv Developer Platform Migration Audit Report

## Executive Summary

This report identifies the current state of the Brixxie/ProfitHub project and provides a comprehensive plan for migrating to the latest Deriv Developer Platform.

**Current Status**: The project is in a hybrid state with:
- Legacy v3 API/WebSocket integration (`@deriv/deriv-api`)
- Partial OAuth 2.0 PKCE implementation
- Some new DerivWS REST endpoints being used
- Mixed v3 and v4 protocol usage

---

## Phase 1: Migration Audit Report

### 1.1 Authentication System Audit

| File | Purpose | Legacy Dependency | Recommended Replacement | Priority | Risk |
|------|---------|-------------------|------------------------|----------|------|
| `api/oauth/start.js` | Initiates OAuth 2.0 PKCE flow | N/A (good) | Keep and enhance | Low | Low |
| `api/oauth/callback.js` | Handles OAuth callback and token exchange | N/A (good) | Keep and enhance | Low | Low |
| `api/oauth/refresh.js` | Token refresh | Needs review | Keep and enhance | Medium | Medium |
| `api/oauth/session.js` | Session management | Needs review | Keep and enhance | Medium | Medium |
| `api/oauth/logout.js` | Logout handler | Needs review | Keep and enhance | Medium | Medium |
| `src/hooks/auth/useOauth2.ts` | OAuth hooks for React | Uses legacy auth patterns | Update to use new Deriv API | High | High |
| `src/services/oauth-token-exchange.service.ts` | Frontend token exchange | Uses legacy patterns | Keep, update to match Deriv docs | Medium | Medium |
| `src/services/api-token-auth.service.ts` | Legacy token auth | Legacy | Remove or deprecate | Low | Low |
| `src/utils/auth-utils.ts` | Auth utilities | Uses legacy storage | Update to match new architecture | Low | Medium |

### 1.2 API Layer Audit

| File | Purpose | Legacy Dependency | Recommended Replacement | Priority | Risk |
|------|---------|-------------------|------------------------|----------|------|
| `src/services/derivws-accounts.service.ts` | Account fetching via new DerivWS API | N/A (good) | Keep and expand | High | Low |
| `src/external/bot-skeleton/services/api/api-base.ts` | Legacy WebSocket API wrapper | `@deriv/deriv-api` v3 | Replace with modern WebSocket client | High | High |
| `src/utils/websocket-handler.ts` | WebSocket utilities | N/A (good, simple) | Keep | Low | Low |

### 1.3 WebSocket Layer Audit

| File | Purpose | Legacy Dependency | Recommended Replacement | Priority | Risk |
|------|---------|-------------------|------------------------|----------|------|
| `src/components/shared/utils/config/config.ts` | Config &amp; WebSocket URL generation | Mixed: uses legacy v3 endpoint and new DerivWS | Standardize on DerivWS API | High | Medium |

### 1.4 Environment &amp; Configuration Audit

| File | Purpose | Legacy Dependency | Recommended Replacement | Priority | Risk |
|------|---------|-------------------|------------------------|----------|------|
| `brand.config.json` | Brand &amp; platform config | Good, has DerivWS config | Keep | Low | Low |

---

## Phase 2: Architecture Review &amp; Design

### 2.1 Current Architecture Problems

1. **Hybrid API usage**: Mixed v3 legacy API and new DerivWS API
2. **WebSocket client locked to v3**: `@deriv/deriv-api` doesn't support new protocol
3. **Duplicate authentication logic**: OAuth token handling in multiple places
4. **Lack of centralized API layer**: No unified API abstraction
5. **No typed request/response models**: Type safety could be improved

### 2.2 Proposed Architecture

```
┌─────────────────────────────────────────┐
│         React UI Components             │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      State Management (MobX)            │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼───────┐   ┌──────▼──────────┐
│  API Service  │   │ WebSocket Serv. │
│   (REST)      │   │   (Real-time)   │
└───────┬───────┘   └──────┬───────────┘
        │                  │
┌───────▼──────────────────▼──────────┐
│  Deriv Developer Platform           │
│  (REST + WebSocket)                 │
└─────────────────────────────────────┘
```

### 2.3 Component Separation

1. **Authentication Module** - OAuth 2.0 PKCE, token management
2. **API Client Module** - REST calls (accounts, OTP, etc.)
3. **WebSocket Manager** - Real-time connection, subscriptions
4. **Account Service** - Account switching, balance
5. **Trading Service** - Contract proposals, orders
6. **Bot Service** - Strategy execution
7. **State Management** - MobX stores

---

## Phase 3: Authentication Review

### 3.1 Current OAuth Implementation Status

✅ **Good**:
- Uses PKCE (Proof Key for Code Exchange)
- Server-side token exchange (api/oauth/callback.js)
- Token refresh endpoint
- Session management

⚠️ **Needs Improvement**:
- Frontend token storage in sessionStorage (should be HttpOnly cookies)
- Multiple token storage locations (cookies + sessionStorage)
- No token refresh auto-trigger before expiry
- No centralized auth state management

### 3.2 Deriv Developer Platform Requirements

From https://developers.deriv.com/docs/intro/oauth/:
1. Always use PKCE for browser-based apps
2. Token exchange must happen server-side
3. Access tokens expire in 1 hour
4. Use refresh tokens to get new access tokens
5. Use OTP endpoint to get authenticated WebSocket URLs

---

## Phase 4: API Abstraction Layer Requirements

### 4.1 Core Requirements

- ✅ Typed request/response models
- ✅ Centralized error handling
- ✅ Retry policy for transient errors
- ✅ Request timeout handling
- ✅ Request/response logging
- ✅ WebSocket message routing
- ✅ Automatic reconnection
- ✅ Heartbeat support

### 4.2 Existing Implementation Gaps

- No centralized REST API client (derivws-accounts.service.ts is partial)
- No unified WebSocket manager
- No type definitions for all API endpoints
- No retry logic
- Limited logging

---

## Phase 5: Bot Template Review

### 5.1 Current State

The bot implementation is in `src/external/bot-skeleton/`. This will need review later, but the priority is the core API/connection layer first.

---

## Phase 6: Migration Plan

### 6.1 Step-by-Step Migration

1. **Phase 1 (Complete)**: Audit &amp; Document
2. **Phase 2**: Architecture Design
3. **Phase 3**: Authentication Enhancement
   - Keep existing OAuth endpoints (they're already good)
   - Add auto-refresh before token expiry
   - Centralize token management
   - Improve error handling
4. **Phase 4**: Build Centralized API Layer
   - Create unified DerivAPI client
   - Add type definitions
   - Implement retry/timeout
5. **Phase 5**: Build Modern WebSocket Manager
   - Use native WebSocket (not @deriv/deriv-api)
   - Handle authenticated WebSocket URLs via OTP
   - Auto-reconnection logic
6. **Phase 6**: Migrate Legacy Usage
   - Gradually replace api-base.ts usage
   - Test each component
7. **Phase 7**: Bot Integration
8. **Phase 8**: Testing &amp; Documentation

---

## Phase 7: Risks &amp; Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes to existing features | Medium | High | Gradual migration, feature flags, extensive testing |
| WebSocket connection instability | Medium | Medium | Robust reconnection logic, heartbeat, fallback mechanisms |
| Token expiry causing disconnections | High | Medium | Auto-refresh 5 mins before expiry, background refresh |
| Legacy @deriv/deriv-api incompatibility | High | High | Keep legacy running in parallel during migration |

---

## Summary

### What's Already Good
- ✅ OAuth 2.0 PKCE implementation (server-side token exchange)
- ✅ DerivWS accounts service already exists
- ✅ Brand config includes DerivWS endpoints
- ✅ Some type safety

### What Needs Work
- 🔄 Unify API/WebSocket layer
- 🔄 Add token auto-refresh
- 🔄 Remove dependency on legacy @deriv/deriv-api
- 🔄 Better type coverage
- 🔄 Centralized state management for auth
