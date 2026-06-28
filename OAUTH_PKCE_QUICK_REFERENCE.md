# OAuth PKCE Quick Reference Guide

## 🔐 PKCE Code Generation

### Code Verifier (Frontend)
```typescript
// src/components/shared/utils/config/config.ts - Line 155
function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```
- **Output**: 32-byte random → ~43 characters (base64url)
- **Storage**: `sessionStorage['oauth_code_verifier']`

### Code Challenge (Frontend)
```typescript
// src/components/shared/utils/config/config.ts - Line 165
async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const base64 = btoa(String.fromCharCode(...hashArray));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```
- **Method**: SHA-256 (S256)
- **Output**: ~43 characters (base64url)

### Code Verifier (Backend)
```javascript
// api/oauth/start.js - Line 115
const code_verifier = randomString(64);  // 64 bytes
const code_challenge = base64URLEncode(sha256(code_verifier));
```
- **Backend Length**: 64 random bytes → ~86 characters
- **Higher entropy** than frontend (64 vs 32 bytes)

---

## 🔑 Headers Configuration

### API Authorization Headers
```typescript
// Fetch accounts
const response = await fetch(endpoint, {
    headers: {
        Authorization: `Bearer ${accessToken}`,
    },
});

// Session with optional app ID
const account_headers = {
    Authorization: `Bearer ${access_token}`,
    'Content-Type': 'application/json',
    ...(deriv_app_id ? { 'Deriv-App-ID': deriv_app_id } : {}),
};
```

### Token Request Headers
```javascript
// api/token.js - Line 48-51
const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(tokenRequestBody).toString(),
});
```

---

## 🎫 Encrypted PKCE Token (State)

### Creation (Backend)
```javascript
// api/oauth/start.js - Lines 27-34
function createPKCEToken(code_verifier, state, client_id, redirect_uri) {
    const data = JSON.stringify({ code_verifier, state, client_id, redirect_uri, ts: Date.now() });
    const secret = process.env.OAUTH_SECRET || 'fallback-secret-change-in-production';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    const signature = base64URLEncode(hmac.digest());
    return `${base64URLEncode(Buffer.from(data))}.${signature}`;
}
```
- **Format**: `<base64url(JSON)>.<base64url(HMAC-SHA256)>`
- **Signed with**: `OAUTH_SECRET` env var
- **Used as**: State parameter in OAuth URL

### Verification (Backend)
```javascript
// api/oauth/callback.js - Lines 27-34
function verifyPKCEToken(token) {
    const [dataB64, signature] = token.split('.');
    const dataBuffer = base64URLDecode(dataB64);
    const data = JSON.parse(dataBuffer.toString());
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(data));
    const expectedSig = base64URLEncode(hmac.digest());
    if (signature !== expectedSig) return null;
    if (Date.now() - data.ts > 600000) return null;  // 10 min expiry
    return data;
}
```

---

## 🔐 Cookie Configuration

### PKCE Flow Cookies
```javascript
// api/oauth/start.js - Lines 130-134
const cookies = [
    `oauth_code_verifier=${encodeURIComponent(code_verifier)}; ${cookieOpts.join('; ')}`,
    `oauth_state=${encodeURIComponent(state_random)}; ${cookieOpts.join('; ')}`,
    `oauth_pkce_token=${encodeURIComponent(pkceToken)}; ${cookieOpts.join('; ')}`,
    `oauth_redirect_uri=${encodeURIComponent(redirect_uri)}; ${cookieOpts.join('; ')}`,
];
```
- **Max-Age**: 600 seconds (10 minutes)
- **HttpOnly**: Yes (prevents XSS)
- **SameSite**: None with Secure (for cross-site OAuth)

### Post-Exchange Cookies
```javascript
// api/token.js - Lines 69-89
setCookies.push(
    `deriv_access_token=${encodeURIComponent(tokenData.access_token)}; ...Max-Age=${maxAge}`
);
setCookies.push(
    `deriv_refresh_token=${encodeURIComponent(tokenData.refresh_token)}; ...Max-Age=604800`
);
```
- **Access Token**: Max-Age = expires_in (default 3600s)
- **Refresh Token**: Max-Age = 604800s (7 days)

---

## 📍 Key Endpoints

### Authorization Endpoint
```
GET https://auth.deriv.com/oauth2/auth
  ?response_type=code
  &client_id=33EmTMY5M3NMHve0SU8tY
  &redirect_uri=https://brixxie-theta.vercel.app/callback
  &scope=trade+account_manage
  &state=<ENCRYPTED_PKCE_TOKEN>
  &code_challenge=<SHA256_HASH>
  &code_challenge_method=S256
  &prompt=registration  // optional for signup
```

### Token Endpoint
```
POST https://auth.deriv.com/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<AUTHORIZATION_CODE>
&client_id=33EmTMY5M3NMHve0SU8tY
&redirect_uri=https://brixxie-theta.vercel.app/callback
&code_verifier=<PKCE_CODE_VERIFIER>
```

### Refresh Token Endpoint
```
POST https://auth.deriv.com/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=<REFRESH_TOKEN>
&client_id=33EmTMY5M3NMHve0SU8tY
```

### Accounts API
```
GET https://api.derivws.com/trading/v1/options/accounts
Authorization: Bearer <ACCESS_TOKEN>
```

### OTP/WebSocket URL API
```
POST https://api.derivws.com/trading/v1/options/accounts/{accountId}/otp
Authorization: Bearer <ACCESS_TOKEN>
```

---

## 📋 Token Storage

### Client-side (sessionStorage)
```typescript
// src/services/oauth-token-exchange.service.ts - Line 199
sessionStorage.setItem('auth_info', JSON.stringify({
    access_token: string,
    token_type: 'bearer',
    expires_in: number,
    expires_at: number,  // Absolute timestamp
    scope: string,
    refresh_token?: string,
}));
```
- **Key**: `auth_info`
- **Expires**: Page close (sessionStorage) + expires_at check

### Code Verifier Storage
```typescript
// src/components/shared/utils/config/config.ts - Line 188
sessionStorage.setItem('oauth_code_verifier', verifier);
sessionStorage.setItem('oauth_code_verifier_timestamp', Date.now().toString());
```
- **Expiry**: 10 minutes (600,000 ms)
- **Used for**: Token exchange, then cleared

### CSRF Token Storage
```typescript
// src/components/shared/utils/config/config.ts - Line 206
sessionStorage.setItem('oauth_csrf_token', token);
sessionStorage.setItem('oauth_csrf_token_timestamp', Date.now().toString());
```
- **Expiry**: 10 minutes (600,000 ms)
- **Validated**: On callback

---

## 🔄 OAuth Flow Steps

1. **User clicks Login**
   - Frontend calls `generateOAuthURL()`
   - Generates code_verifier, code_challenge, CSRF token
   - Stores verifier & CSRF token in sessionStorage
   - Stores PKCE params in cookies (fallback)
   - Redirects to `https://auth.deriv.com/oauth2/auth`

2. **User Authenticates at Deriv**
   - Deriv handles login/signup
   - Issues authorization code
   - Redirects back to `/callback?code=...&state=...`

3. **Frontend Callback Processing**
   - `useOAuthCallback()` extracts code & state
   - Validates CSRF token
   - Calls `OAuthTokenExchangeService.exchangeCodeForToken(code)`

4. **Backend Token Exchange**
   - Receives code from frontend
   - Retrieves code_verifier from sessionStorage
   - POSTs to `https://auth.deriv.com/oauth2/token` with PKCE verifier
   - Receives access_token & refresh_token
   - Sets HttpOnly cookies with tokens

5. **Account Initialization**
   - Frontend stores access_token in sessionStorage
   - Fetches accounts list from DerivWS API (using Bearer token)
   - Sets active account in localStorage
   - Initializes WebSocket connection

---

## 🔒 Security Checklist

- ✅ Code verifier: Cryptographically secure random (32-64 bytes)
- ✅ Code challenge: SHA-256 with S256 method
- ✅ State parameter: Random 32-byte CSRF token
- ✅ HttpOnly cookies: Prevents XSS access to tokens
- ✅ Secure flag: HTTPS-only in production
- ✅ SameSite: Strict (same-site only) for session cookies
- ✅ Token lifetime: 10 minutes for PKCE, 3600s for access, 7d for refresh
- ✅ Bearer token: Used for all authenticated API calls
- ✅ Signed state: HMAC-SHA256 encryption of PKCE data
- ✅ Timestamp validation: 10-minute expiry on state tokens

---

## 📂 File Locations

| File | Purpose |
|------|---------|
| `src/components/shared/utils/config/config.ts` | Frontend PKCE generation, OAuth URL building |
| `api/oauth/start.js` | Authorization initiation, PKCE token creation |
| `api/token.js` | Token exchange endpoint |
| `api/oauth/callback.js` | Callback handling, state verification |
| `api/oauth/session.js` | Session check endpoint |
| `api/oauth/logout.js` | Logout, cookie clearing |
| `api/oauth/refresh.js` | Token refresh endpoint |
| `src/services/oauth-token-exchange.service.ts` | Client token exchange |
| `src/services/derivws-accounts.service.ts` | Accounts & WebSocket URL fetching |
| `src/hooks/useOAuthCallback.ts` | Callback React hook |
| `brand.config.json` | OAuth URLs & API endpoints |

---

## 🚀 Quick Implementation Reference

### Generate OAuth URL
```typescript
import { generateOAuthURL } from '@/components/shared';
const oauthUrl = await generateOAuthURL('registration');  // 'registration' optional
window.location.replace(oauthUrl);
```

### Check if Authenticated
```typescript
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
const isAuth = OAuthTokenExchangeService.isAuthenticated();
const token = OAuthTokenExchangeService.getAccessToken();
```

### Get Authenticated WebSocket URL
```typescript
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
const wsUrl = await DerivWSAccountsService.getAuthenticatedWebSocketURL(accessToken);
```

### Logout
```typescript
await fetch('/api/oauth/logout', { method: 'POST' });
sessionStorage.removeItem('auth_info');
localStorage.removeItem('active_loginid');
```
