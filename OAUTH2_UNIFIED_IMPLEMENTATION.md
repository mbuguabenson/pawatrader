# Unified OAuth2 PKCE Implementation - Configuration Guide

## Overview
This guide explains the unified OAuth2 PKCE authentication system for trading platforms. It supports:
- **Legacy CR Accounts** - Backward compatible
- **New Wallet Accounts** - DOT (crypto) and ROT (real) accounts
- **Server-side Token Storage** - HttpOnly, Secure cookies for maximum security
- **Automatic Token Refresh** - Seamless background refresh 5 minutes before expiry

---

## Environment Configuration

### Required Environment Variables

```bash
# OAuth2 Configuration
DERIV_OAUTH_CLIENT_ID=your_client_id          # OAuth2 Client ID from Deriv
DERIV_APP_ID=your_app_id                      # (Legacy) App ID for backward compatibility
DERIV_CLIENT_SECRET=your_client_secret        # OAuth2 Client Secret (backend only)
DERIV_REDIRECT_URI=https://yoursite.com/      # Exact OAuth callback URL

# Node Environment
NODE_ENV=production                            # or 'development'
```

### Optional Environment Variables

```bash
# Frontend
REACT_APP_DERIV_OAUTH_CLIENT_ID=your_client_id
REACT_APP_DERIV_APP_ID=your_app_id
REACT_APP_DERIV_REDIRECT_URI=https://yoursite.com/

# Vite
VITE_DERIV_OAUTH_CLIENT_ID=your_client_id
VITE_DERIV_APP_ID=your_app_id
VITE_DERIV_REDIRECT_URI=https://yoursite.com/
```

---

## OAuth2 Flow Steps

### 1. Login Initiation (`/api/oauth/start`)

**Request:**
```
GET /api/oauth/start
```

**Query Parameters:**
- `client_id` (optional) - OAuth client ID
- `redirect_uri` (optional) - Callback URL
- `account` (optional) - Preferred account to auto-select

**What it does:**
1. Generates `code_verifier` (128 characters)
2. Computes `code_challenge = SHA256(code_verifier)` in base64url
3. Generates `state` for CSRF protection
4. Stores `code_verifier` and `state` in **HttpOnly, Secure cookies**
5. Redirects to: `https://auth.deriv.com/oauth2/auth?client_id=...&code_challenge=...&state=...&scope=trade`

**Cookies Set:**
```
oauth_code_verifier=<128-char-random>; HttpOnly; Secure; SameSite=Strict; Max-Age=600
oauth_state=<32-char-random>; HttpOnly; Secure; SameSite=Strict; Max-Age=600
```

**Security:**
- PKCE code_verifier never leaves server
- State parameter protects against CSRF
- HttpOnly prevents JavaScript access (XSS protection)

---

### 2. User Authentication (Deriv OAuth Server)

User logs in at `https://auth.deriv.com/oauth2/auth`:
1. Enters email/password
2. Completes 2FA if enabled
3. Reviews permissions ("Authorize this app?")
4. Clicks "Authorize"

---

### 3. Authorization Callback (`/api/oauth/callback`)

**Request:**
```
GET /api/oauth/callback?code=AUTH_CODE&state=STATE_VALUE
```

**What it does:**

**Step 1: CSRF Validation**
```javascript
storedState = cookies.oauth_state
receivedState = query.state
if (storedState !== receivedState) throw 'CSRF_ATTACK_DETECTED'
```

**Step 2: Retrieve PKCE Verifier**
```javascript
codeVerifier = cookies.oauth_code_verifier
```

**Step 3: Token Exchange**
```javascript
POST https://auth.deriv.com/oauth2/token
{
  grant_type: "authorization_code",
  code: AUTH_CODE,
  code_verifier: codeVerifier,           // PKCE proof
  client_id: DERIV_OAUTH_CLIENT_ID,
  redirect_uri: DERIV_REDIRECT_URI,
  client_secret: DERIV_CLIENT_SECRET     // Backend only
}
```

**Step 4: Validate Response**
```javascript
{
  access_token: "token_xyz",
  refresh_token: "refresh_xyz",
  expires_in: 3600,                      // 1 hour
  token_type: "Bearer",
  scope: "trade"
}
```

**Step 5: Store Tokens in HttpOnly Cookies**
```
deriv_access_token=token_xyz; HttpOnly; Secure; SameSite=Strict; Max-Age=3600
deriv_refresh_token=refresh_xyz; HttpOnly; Secure; SameSite=Strict; Max-Age=604800 (7 days)
deriv_token_expires_at=1719999999000; HttpOnly; Secure; SameSite=Strict; Max-Age=3600
logged_state=true; Secure; SameSite=Strict
```

**Step 6: Account Discovery**
```javascript
GET https://api.deriv.com/api/v3?action=account_list
Authorization: Bearer token_xyz
Deriv-App-Id: APP_ID

Response:
{
  account_list: [
    {
      loginid: "CR7917545",              // Legacy CR account
      account_type: "cr",
      currency: "USD",
      is_virtual: false,
      email: "user@example.com"
    },
    {
      loginid: "VRTC11729450",           // Demo account
      account_type: "demo",
      currency: "USD",
      is_virtual: true
    },
    {
      loginid: "DOT123456789",           // New crypto wallet
      account_type: "dot",
      currency: "USDT",
      is_virtual: false
    }
  ]
}
```

**Step 7: Auto-select Account**
Priority: preferred > CR > DOT > ROT > first

```javascript
selectedAccount = accounts.find(a => a.loginid === preferred)
  || accounts.find(a => a.account_type === 'cr')
  || accounts.find(a => a.account_type === 'dot')
  || accounts.find(a => a.account_type === 'rot')
  || accounts[0]

Set cookie:
deriv_selected_account=CR7917545; HttpOnly; Secure; SameSite=Strict
```

**Step 8: Redirect to Frontend**
```
302 Redirect to /
```

---

### 4. Session Restoration (`/api/oauth/session`)

**Request (Frontend calls on app startup):**
```
GET /api/oauth/session
Cookie: deriv_access_token=...; deriv_refresh_token=...
```

**What it does:**
1. Reads `deriv_access_token` from cookies (automatic, browser sends)
2. Validates token with Deriv API
3. If token expired → attempts refresh with `refresh_token`
4. Returns account list and session data

**Response (200 OK):**
```javascript
{
  logged_in: true,
  access_token: "token_xyz",
  app_id: "APP_ID",
  accounts: [
    {
      account_id: "CR7917545",
      account_type: "cr",
      currency: "USD",
      email: "user@example.com"
    }
  ],
  account_id: "CR7917545",               // Selected
  account_type: "cr",
  currency: "USD"
}
```

**Response (200 OK - Not logged in):**
```javascript
{
  logged_in: false,
  accounts: []
}
```

---

### 5. Token Refresh (`/api/oauth/refresh`)

**Request (Frontend or backend):**
```
POST /api/oauth/refresh
Cookie: deriv_refresh_token=...
```

**What it does:**
```javascript
POST https://auth.deriv.com/oauth2/token
{
  grant_type: "refresh_token",
  refresh_token: REFRESH_TOKEN,
  client_id: DERIV_OAUTH_CLIENT_ID,
  client_secret: DERIV_CLIENT_SECRET
}
```

**Response:**
```javascript
{
  access_token: "new_token",
  refresh_token: "new_refresh_token",    // May be rotated
  expires_in: 3600,
  token_type: "Bearer"
}
```

**Updates Cookies:**
```
deriv_access_token=new_token; ...
deriv_refresh_token=new_refresh_token; ...
deriv_token_expires_at=<new_expiry>; ...
```

---

### 6. Logout (`/api/oauth/logout`)

**Request:**
```
POST /api/oauth/logout
```

**What it does:**
1. Clears all OAuth cookies
2. Sets Max-Age=0 to delete them

**Clears:**
```
deriv_access_token=; Max-Age=0
deriv_refresh_token=; Max-Age=0
deriv_token_expires_at=; Max-Age=0
deriv_selected_account=; Max-Age=0
logged_state=; Max-Age=0
oauth_code_verifier=; Max-Age=0
oauth_state=; Max-Age=0
```

**Frontend also clears:**
```javascript
localStorage.removeItem('accountsList')
localStorage.removeItem('authToken')
localStorage.removeItem('clientAccounts')
localStorage.removeItem('active_loginid')
sessionStorage.clear()
```

---

## Account Type Support

### CR Accounts (Legacy)
- Standard Deriv accounts
- Prefixed with "CR"
- Direct trading and balances
- Fully backward compatible

### DOT Accounts (Crypto Wallet - New)
- Deriv crypto wallet accounts
- Prefixed with "DOT"
- Support multiple cryptocurrencies
- Use WebSocket session for real-time data

### ROT Accounts (Real Wallet - New)
- Deriv real money wallet accounts
- Prefixed with "ROT"
- For fiat currencies
- Use WebSocket session for real-time data

### Demo Accounts (Virtual)
- Sandbox accounts for testing
- Prefixed with "VRTC"
- `is_virtual: true`
- Practice without real money

---

## Error Handling

### Common Errors and Recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| `invalid_grant` | Code expired, invalid, or reused | Retry login |
| `invalid_state` | CSRF attack or cookie lost | Retry login |
| `redirect_uri_mismatch` | Configuration error | Check DERIV_REDIRECT_URI |
| `invalid_scope` | "trade" scope not requested | Check configuration |
| `access_denied` | User clicked "Don't authorize" | Show login screen again |
| `server_error` | Deriv API error | Retry or show error |
| `token_expired` | Access token expired | Use refresh_token |
| `refresh_token_expired` | Refresh token expired | Login again |

---

## Security Best Practices

### PKCE (Proof Key for Public Clients)
✅ **Enabled**
- Code verifier: 128 random characters
- Challenge: SHA256(verifier) in base64url
- Method: S256
- Prevents authorization code interception

### State Parameter (CSRF Protection)
✅ **Enabled**
- 32-character random state
- Stored in secure cookie
- Validated on callback
- Prevents cross-site request forgery

### HttpOnly Cookies
✅ **Enabled**
- Tokens stored in HttpOnly cookies
- JavaScript cannot access via `document.cookie`
- Only sent with HTTP requests
- Prevents XSS token theft

### Secure Flag
✅ **Production Only**
- Cookies marked `Secure` in HTTPS
- Not sent over HTTP
- Production check: `NODE_ENV === 'production'`

### SameSite Attribute
✅ **Strict**
- Cookies not sent in cross-site requests
- Prevents CSRF attacks
- Value: `SameSite=Strict`

### Token Encryption (Optional)
- Tokens can be encrypted before storage
- Requires `CryptoJS` or similar
- Additional layer for sensitive deployments

---

## Frontend Implementation

### 1. Trigger Login
```javascript
import { useOauth2 } from '@/hooks/auth/useOauth2';

function LoginButton() {
  const { loginWithOAuth } = useOauth2();
  
  return (
    <button onClick={() => loginWithOAuth()}>
      Login with Deriv
    </button>
  );
}
```

### 2. Handle Callback
```javascript
// Automatically handled by AuthWrapper
// useOAuthCallback hook validates callback params
// Cleans up URL parameters
```

### 3. Restore Session
```javascript
// In AuthWrapper component
const restoreLoginFromServerSession = async () => {
  const response = await fetch('/api/oauth/session', {
    credentials: 'same-origin'
  });
  
  const sessionData = await response.json();
  
  if (sessionData.logged_in) {
    // Session restored, user is logged in
    localStorage.setItem('accountsList', ...);
    localStorage.setItem('active_loginid', ...);
  }
};
```

### 4. Logout
```javascript
const { oAuthLogout } = useOauth2();

oAuthLogout();  // Clears server session and frontend
```

---

## Backend Implementation

### Node.js/Vercel Handler Example

**Environment Setup:**
```bash
export DERIV_OAUTH_CLIENT_ID=your_id
export DERIV_CLIENT_SECRET=your_secret
export DERIV_REDIRECT_URI=https://yoursite.com/
export NODE_ENV=production
```

**Start OAuth Flow:**
```javascript
// GET /api/oauth/start redirects to Deriv
// Automatically sets secure cookies
```

**Handle Callback:**
```javascript
// GET /api/oauth/callback?code=...&state=...
// Validates state
// Exchanges code for tokens
// Stores in secure cookies
// Redirects to /
```

**Validate Session:**
```javascript
// GET /api/oauth/session
// Reads cookies
// Returns session data or 401
```

---

## Testing

### Development
```bash
NODE_ENV=development
# SameSite=Lax (more permissive)
# Secure flag not required
# localhost works without HTTPS
```

### Production
```bash
NODE_ENV=production
# SameSite=Strict (strict)
# Secure flag required (HTTPS only)
# Must use registered redirect_uri
```

### Test Checklist
- [ ] Login flow completes
- [ ] Tokens stored in secure cookies
- [ ] Session persists after page reload
- [ ] Account list fetched correctly
- [ ] CR/DOT/ROT accounts all appear
- [ ] Token refresh works automatically
- [ ] Logout clears all session data
- [ ] Error messages are user-friendly
- [ ] CSRF protection active
- [ ] PKCE validation passes

---

## Documentation Links

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Deriv OAuth Documentation](https://developers.deriv.com/docs/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
