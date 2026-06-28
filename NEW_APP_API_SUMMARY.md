# New App & API Implementation Summary

## New App Overview

- The new app integrates Deriv OAuth 2.0 Authorization Code + PKCE flow for secure browser-based login.
- It supports both modern PKCE client_id-based OAuth and a legacy app_id fallback for compatibility.
- Login is initiated from the UI in `src/components/layout/header/header.tsx` using `generateOAuthURL()`.
- The system prefers secure session storage and HttpOnly cookies for sensitive OAuth data.

## API Implementation

- `api/oauth/start.js`
  - Generates `code_verifier`, `code_challenge`, and `state`.
  - Stores PKCE and state data in secure cookies.
  - Redirects the browser to `https://oauth.deriv.com/oauth2/authorize`.

- `api/oauth/callback.js`
  - Handles Deriv redirect callbacks with `code` and `state`.
  - Verifies state and recovers PKCE verifier.
  - Exchanges authorization code for tokens at `https://oauth.deriv.com/oauth2/token`.
  - Sets secure cookies: `deriv_access_token`, `deriv_refresh_token`, `deriv_token_expires`, and optional `deriv_app_id`.
  - Clears PKCE cookies after success.

## Client-side Support

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

## Key Notes

- The new API flow keeps PKCE state and verifier secure by using signed tokens and secure cookies.
- `redirect_uri` must exactly match configured callback URLs for successful OAuth exchange.
- The implementation is designed to be compatible with both production and local/dev environments via config fallbacks.
