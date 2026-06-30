
# Phase 1: Authentication Audit Report

## Overview

This report identifies all authentication-related files in the codebase, categorizes them as legacy, PKCE, or unused, and provides recommendations for migration.

---

## File Audit

| File Path | Purpose | Keep/Replace/Delete | Migration Priority | Notes |
|-----------|---------|---------------------|--------------------|-------|
| **src/utils/auth-utils.ts** | Auth data clearing utility (both legacy &amp; PKCE) | Keep | Medium | Update to remove legacy token handling |
| **src/utils/session-token-utils.ts** | Legacy session token storage | Delete | Medium | Not used by PKCE flow |
| **src/hooks/useOAuthCallback.ts** | Callback handler (supports both legacy acct1/token1 &amp; PKCE) | Keep (Refactor) | High | Remove legacy account parsing |
| **src/hooks/useLogout.ts** | Unified logout for both flows | Keep | High | Already supports both flows - good! |
| **src/hooks/useInvalidTokenHandler.ts** | Invalid token handler (redirects to OAuth login) | Keep | Medium | Good, no legacy issues here |
| **api/token.js** | Legacy token exchange endpoint | Delete | High | Replaced by api/oauth/callback.js |
| **api/websocket/session.js** | Legacy WS session endpoint (uses cookies) | Delete | Low | Not used by current flow |
| **src/examples/OAuthImplementationExamples.tsx** | Example implementation code (unused) | Delete | Low | Documentation only, no production use |
| **src/services/api-token-auth.service.ts** | API token login (legacy alternative) | Keep (Optional) | Low | Keep as backup, but not primary flow |
| **src/components/shared/utils/login/login.ts** | Login redirect utilities (uses PKCE) | Keep | Medium | Good - uses generateOAuthURL |
| **api/oauth/start.js** | PKCE OAuth start | Keep | Critical | Already implemented |
| **api/oauth/callback.js** | PKCE callback &amp; token exchange | Keep | Critical | Already implemented |
| **api/oauth/session.js** | PKCE session management | Keep | High | Already implemented |
| **api/oauth/refresh.js** | PKCE token refresh | Keep | High | Already implemented |
| **api/oauth/logout.js** | PKCE logout | Keep | High | Already implemented |
| **src/services/oauth-token-exchange.service.ts** | PKCE token exchange &amp; account fetching | Keep | Critical | Primary service |
| **src/services/derivws-accounts.service.ts** | PKCE DerivWS account &amp; OTP fetching | Keep | Critical | Primary service |
| **src/components/shared/utils/config/config.ts** | Config &amp; generateOAuthURL | Keep | Critical | Good! |
| **src/app/AuthWrapper.tsx** | App auth init (with fixes from earlier) | Keep | Critical | Already fixed to not hang |
| **src/pages/callback/callback-page.tsx** | OAuth callback UI | Keep | Critical | Already implemented |
| **src/app/App.tsx** | App entry that uses useOAuthCallback | Keep | Critical | Already implemented |
| **src/external/bot-skeleton/services/api/appId.js** | Deriv API instance creator | Keep | Critical | Just fixed the onmessage override bug! |
| **src/external/bot-skeleton/services/api/api-base.ts** | API base (with active symbols timeout) | Keep | Critical | Already has fallback, just lower timeout |
| **src/utils/api-token-permissions.ts** | API token utilities | Keep (Optional) | Low | Keep as backup |
| **src/utils/account-helpers.ts** | Account helpers (active_loginid etc) | Keep | Medium | Good |
| **src/external/bot-skeleton/utils/token-helper.js** | Legacy token helper | Delete | Low | Not used |
| **src/hooks/auth/useOauth2.ts** | (Check if exists, likely duplicate) | Delete | High | If present, duplicate of existing flow |

---

## Legacy localStorage keys to remove

- `authToken` (legacy auth token)
- `accountsList` (legacy account tokens)
- `clientAccounts` (legacy account data)
- `callback_token` (legacy callback token)
- `session_token` (legacy session token)

Legacy keys we still use:
- `active_loginid` (still used for account switching)
- `account_type` (still used to track demo/real)

---

## Legacy URL params to remove

- `acct1`, `acct2`, ... (legacy account IDs)
- `token1`, `token2`, ... (legacy account tokens)
- `cur1`, `cur2`, ... (legacy account currencies)

---

## Next Steps

1.  Delete all files marked "Delete"
2.  Refactor `useOAuthCallback.ts` to remove legacy account parsing
3.  Refactor `auth-utils.ts` to remove legacy localStorage keys
4.  Refactor `appId.js` (already done the onmessage fix)
5.  Proceed to Phase 2

---

## Summary

The application already has a **complete PKCE OAuth 2.0 implementation**! The main issues are:
- Legacy duplicate files that are unused
- Mixed legacy/PKCE code in some files
- We just fixed the WebSocket onmessage override bug that caused active symbols to fail!

