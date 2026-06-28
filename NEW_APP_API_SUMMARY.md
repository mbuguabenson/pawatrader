# New App & API Implementation Summary

## Production URLs
- **Brand Domain**: https://www.profithub.co.ke/
- **OAuth2 Auth Endpoint**: Configured via `brand.config.json` platform.auth2_url (staging/production)
- **OAuth2 Token Endpoint**: `{auth2_url}token`

## New App Overview

- The new app integrates Deriv OAuth 2.0 Authorization Code + PKCE flow for secure browser-based login.
- It supports both modern PKCE client_id-based OAuth and a legacy app_id fallback for compatibility.
- Login is initiated from the UI in `src/components/layout/header/header.tsx` using `generateOAuthURL()`.
- The system prefers secure session storage and HttpOnly cookies for sensitive OAuth data.
- **PKCE Security**: Uses SHA-256 code_challenge method (S256) with cryptographically secure code_verifiers.

## API Implementation

### OAuth Flow Endpoints

**1. OAuth Start/Auth Authorization (`src/components/shared/utils/config/config.ts::generateOAuthURL`)**
- Generates cryptographically secure PKCE parameters:
  - **code_verifier**: 32-byte random value (Base64 URL-safe encoded, 43 characters)
  - **code_challenge**: SHA-256 hash of code_verifier (S256 method per RFC 7636)
  - **state**: CSRF token (32-byte random value, 10-minute expiry)
- Stores code_verifier in `sessionStorage` with 10-minute expiry
- Constructs authorization URL with parameters:
  ```
  {auth2_url}auth?scope=trade+account_manage&response_type=code
    &client_id={clientId}&redirect_uri={redirectUrl}
    &state={csrfToken}&code_challenge={codeChallenge}
    &code_challenge_method=S256&app_id={appId}
  ```
- Production redirect_uri: `https://{brandConfig.brand_domain}/` 
- Supports optional `prompt` parameter (e.g., 'registration' for signup)

**2. OAuth Token Exchange (`api/token.ts`)**
- Backend proxy endpoint that forwards token exchange to Deriv
- Receives from client:
  - `code`: Authorization code from OAuth callback
  - `code_verifier`: PKCE verifier (proves original requester)
  - `redirect_uri`: Must exactly match authorization request
  - `client_id`: OAuth application ID
- Exchanges with `https://auth.deriv.com/oauth2/token` using:
  ```
  grant_type=authorization_code
  code={code}
  code_verifier={code_verifier}
  redirect_uri={redirect_uri}
  client_id={client_id}
  ```
- Returns access_token, refresh_token, expires_in, scope

**3. Client-side Token Exchange (`src/services/oauth-token-exchange.service.ts`)**
- Calls `/api/token` endpoint with authorization code
- Validates code_verifier exists and hasn't expired
- Stores authentication in `sessionStorage` as `auth_info`:
  ```json
  {
    "access_token": "...",
    "token_type": "bearer",
    "expires_in": 3600,
    "expires_at": <timestamp>,
    "scope": "trade account_manage",
    "refresh_token": "..."
  }
  ```
- Clears code_verifier after successful exchange
- Validates token expiry before each use

### Legacy Implementation (Previous)

**`api/oauth/start.js`**
- Generates `code_verifier`, `code_challenge`, and `state`.
- Stores PKCE and state data in secure cookies.
- Redirects the browser to `https://oauth.deriv.com/oauth2/authorize`.

**`api/oauth/callback.js`**
- Handles Deriv redirect callbacks with `code` and `state`.
- Verifies state and recovers PKCE verifier.
- Exchanges authorization code for tokens at `https://oauth.deriv.com/oauth2/token`.
- Sets secure cookies: `deriv_access_token`, `deriv_refresh_token`, `deriv_token_expires`, and optional `deriv_app_id`.
- Clears PKCE cookies after success.

## Client-side Support

### Modern Implementation (v2)
- **OAuth URL Generation** (`src/components/shared/utils/config/config.ts`)
  - Builds OAuth URLs with `code_challenge`, `state`, and required scopes
  - Stores PKCE verifier and CSRF tokens in `sessionStorage` with expiry validation
  - Resolves domain-specific `clientId`, `appId`, and `redirectUri` from environment & config
  - Validates CSRF token on callback (10-minute expiry, one-time use)

- **Token Exchange Service** (`src/services/oauth-token-exchange.service.ts`)
  - Handles code-to-token exchange via `/api/token` endpoint
  - Retrieves and validates stored code_verifier before exchange
  - Stores auth info with token expiry calculation
  - Provides `getAuthInfo()`, `isAuthenticated()`, `getAccessToken()` helpers
  - Automatically clears expired tokens and expired code verifiers

- **Header Integration** (`src/components/layout/header/header.tsx`)
  - Login button triggers `generateOAuthURL()` for registration flow
  - Re-login/account switch uses same flow with token refresh
  - Handles OAuth callback redirect via `/callback` route

### Legacy Implementation (v1)
- `src/components/shared/utils/config/config.ts`
  - Builds OAuth URLs with `code_challenge`, `state`, and required scopes.
  - Stores PKCE verifier and CSRF tokens in `sessionStorage`.
  - Resolves domain-specific `clientId`, `appId`, and `redirectUri` configuration.
- `src/pages/callback/callback-page.tsx`
  - Provides an optional client-side callback page for code exchange and authentication status handling.

## WebSocket and Account Flow

- The app chooses authenticated WebSocket URLs when a valid PKCE token exists.
- Legacy token users continue to use app_id-based WebSocket connections.
- Account and balance state management is integrated through `DerivWSAccountsService` and the bot-skeleton `api_base` initialization.

## Headers & Authentication

All authenticated API requests include:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

Optional legacy header for Deriv API routing:
```
Deriv-App-ID: {app_id}
```

Token format: Bearer tokens from OAuth2 are used directly without transformation.
Token refresh: Handled via refresh_token when access_token expires (see token expiry in auth_info).

## Key Notes

- **PKCE Security**: The implementation uses RFC 7636 PKCE with S256 (SHA-256) method, protecting against authorization code interception attacks
- **Code Verifier Storage**: 32-byte cryptographically secure random value stored in sessionStorage with 10-minute expiry
- **Code Challenge**: SHA-256 hash of code_verifier in Base64 URL-safe encoding
- **CSRF Protection**: state parameter contains a 32-byte random CSRF token validated on callback
- **Token Storage**: Access tokens stored in sessionStorage with calculated expiry timestamp
- **Production Domain**: Must match `brandConfig.brand_domain` (https://www.profithub.co.ke/) for token exchange
- `redirect_uri` must exactly match configured callback URL for successful OAuth exchange
- The implementation is designed to be compatible with both production and local/dev environments via config fallbacks
- Token expiry validation happens before every use - expired tokens are automatically cleared
- Refresh tokens are stored but token refresh logic should be implemented for long-lived sessions
