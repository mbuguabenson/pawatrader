# OAuth 2.0 Authorization Code + PKCE (Deriv)

This project supports a Deriv OAuth 2.0 Authorization Code + PKCE flow.
It includes both a server-side redirect flow in `api/oauth/start.js` / `api/oauth/callback.js` and a client-side PKCE helper in `src/components/shared/utils/config/config.ts`.

## Summary

- Primary authorize endpoint: `https://oauth.deriv.com/oauth2/authorize`
- Primary token endpoint: `https://oauth.deriv.com/oauth2/token`
- Scope used by default: `trade account_manage`
- The flow supports either `client_id` (OAuth PKCE) or legacy `app_id` fallback

## Key files

- `api/oauth/start.js` — starts the OAuth flow, generates PKCE values, stores them in secure cookies, and redirects to Deriv
- `api/oauth/callback.js` — handles the redirect callback, validates state, exchanges code for tokens, sets cookies, and redirects back to `/`
- `src/components/shared/utils/config/config.ts` — client-side helper functions for PKCE and OAuth URL generation
- `src/components/layout/header/header.tsx` — login/signup buttons that redirect to `generateOAuthURL()`
- `src/pages/callback/callback-page.tsx` — optional client-side callback page that can exchange the code using `OAuthTokenExchangeService`

## OAuth flow

### 1. Start OAuth

The public login button in `src/components/layout/header/header.tsx` calls `generateOAuthURL()` from `src/components/shared/utils/config/config.ts`.
This function:

- generates a random `code_verifier`
- computes `code_challenge = SHA256(code_verifier)` in base64url format
- generates a random CSRF `state`
- stores `oauth_code_verifier` and `oauth_csrf_token` in `sessionStorage`
- returns a Deriv authorization URL

The authorization URL includes:

- `response_type=code`
- `client_id` (from `DOMAIN_CONFIG` or `process.env`)
- `redirect_uri` (from `DOMAIN_CONFIG` or env)
- `scope=trade account_manage`
- `state`
- `code_challenge`
- `code_challenge_method=S256`
- optionally `app_id`

### 2. Redirect to Deriv

The browser is redirected to Deriv's OAuth endpoint:

`https://oauth.deriv.com/oauth2/authorize?…`

Deriv authenticates the user and returns to the configured callback URL with `code` and `state`.

### 3. Handle callback

The server-side callback route is `api/oauth/callback.js`.
It supports two modes:

- new mode: PKCE parameters are embedded inside the `state` token and verified server-side
- fallback mode: the callback reads `oauth_state`, `oauth_code_verifier`, `oauth_client_id`, and `oauth_redirect_uri` from cookies

The callback handler then:

- verifies the returned `state`
- recovers the stored `code_verifier`
- determines `client_id` or legacy `app_id`
- determines the `redirect_uri`
- posts to `https://oauth.deriv.com/oauth2/token`
- exchanges `code`, `code_verifier`, `redirect_uri`, and `client_id`/`app_id`

### 4. Store tokens and session data

On successful token exchange, `api/oauth/callback.js` sets secure cookies:

- `deriv_access_token`
- `deriv_refresh_token`
- `deriv_token_expires`
- `deriv_app_id` (if legacy app ID is used)
- `deriv_selected_loginid` (if available)
- `deriv_account_type`
- `deriv_account_currency`
- `logged_state=true`

It also clears PKCE cookies:

- `oauth_code_verifier`
- `oauth_state`
- `oauth_preferred_account`
- `oauth_client_id`
- `oauth_app_id`
- `oauth_redirect_uri`

Finally, it redirects the browser back to `/` by default or returns JSON when requested.

## Environment variables

The server flow reads these environment variables:

- `DERIV_OAUTH_CLIENT_ID` / `OAUTH_CLIENT_ID` / `CLIENT_ID`
- `DERIV_LEGACY_APP_ID` / `APP_ID` / `OAUTH_LEGACY_APP_ID`
- `DERIV_REDIRECT_URI` / `OAUTH_REDIRECT_URI` / `REDIRECT_URI`
- `DERIV_OAUTH_CALLBACK_URI` / `OAUTH_CALLBACK_URI` (fallback)
- `OAUTH_SECRET` — used to sign the PKCE state token
- `NODE_ENV` or `VERCEL` for cookie security behavior

## Frontend login trigger

In `src/components/layout/header/header.tsx`, the login button calls:

```ts
window.location.replace(await generateOAuthURL());
```

This redirects the browser directly to the Deriv auth URL built by `generateOAuthURL()`.

## Client-side callback support

The repository also includes a client-side callback page at `src/pages/callback/callback-page.tsx`.
It can exchange the authorization code using `OAuthTokenExchangeService.exchangeCodeForToken(code)` and `getCodeVerifier()`.

## Legacy token / WebSocket integration

The project uses `getSocketURL()` in `src/components/shared/utils/config/config.ts` to decide whether to use:

- authenticated WebSocket URL via `DerivWSAccountsService.getAuthenticatedWebSocketURL(access_token)`
- legacy WebSocket URL with `app_id`

If a PKCE access token exists in session storage, the authenticated WebSocket URL is preferred.

## Notes

- This repo stores PKCE verifier/state in `sessionStorage` for browser-side flows.
- Server-side cookie storage is used by the `api/oauth/*` endpoints.
- Ensure `redirect_uri` exactly matches the callback URL configured in Deriv.

## Files referenced

- `api/oauth/start.js`
- `api/oauth/callback.js`
- `src/components/shared/utils/config/config.ts`
- `src/components/layout/header/header.tsx`
- `src/pages/callback/callback-page.tsx`
