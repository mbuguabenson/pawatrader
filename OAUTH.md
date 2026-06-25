# OAuth 2.0 Authorization Code + PKCE (Deriv)

Summary

- Implements a server-side Authorization Code + PKCE flow for Deriv using the endpoints:
    - Authorization: https://auth.deriv.com/oauth2/auth
    - Token: https://auth.deriv.com/oauth2/token

Endpoints added

- `/api/oauth/start` (GET): generates `code_verifier` and `state`, stores them in HttpOnly cookies, and redirects the browser to Deriv's authorization endpoint. You may pass `client_id` and `redirect_uri` as query parameters to override server env vars.
- `/api/oauth/callback` (GET): Deriv will redirect here. This endpoint validates the `state`, exchanges the `code` for tokens using the stored `code_verifier`, sets HttpOnly cookies for tokens, and redirects the user back to `/`.

Environment variables

- `DERIV_OAUTH_CLIENT_ID` - (optional) new OAuth client id from the developer portal
- `DERIV_LEGACY_APP_ID` - (optional) numeric legacy app_id (will be included in cookies for later API calls)
- `DERIV_REDIRECT_URI` - (required) the exact redirect URL registered in the developer portal (must match the callback)
- `NODE_ENV` - set to `production` to enable `Secure` cookie flag

Frontend: start the flow

- Trigger the flow by redirecting the browser to the start endpoint. Example:

```js
// Replace with your client id / redirect if needed
const clientId = 'YOUR_CLIENT_ID';
const redirectUri = 'https://your.app.com/api/oauth/callback';
window.location.href = `/api/oauth/start?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
```

What happens on callback

- Deriv redirects back to `/api/oauth/callback?code=...&state=...`.
- Server verifies `state` against the session cookie and exchanges the code for tokens using PKCE (sends original `code_verifier`).
- On success the server sets HttpOnly cookies: `deriv_access_token`, `deriv_refresh_token`, `deriv_token_expires`, and `deriv_app_id` (if configured). The PKCE cookies are cleared.

Using the tokens and legacy `app_id`

- Server-side API calls to Deriv should read `deriv_access_token` from the request cookies and include the legacy `deriv_app_id` when the API requires it.
- Example server-side request headers:

```
Authorization: Bearer <access_token>
X-APP-ID: <legacy_app_id>
```

Security notes

- Tokens are stored as HttpOnly cookies to avoid access from client-side scripts. Adjust storage and session handling to match your app's security model.
- Ensure `DERIV_REDIRECT_URI` exactly matches the URL registered in the developer portal.

Files added

- [api/oauth/start.js](api/oauth/start.js)
- [api/oauth/callback.js](api/oauth/callback.js)
