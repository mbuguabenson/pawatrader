# OAuth PKCE Implementation Analysis - Brixxie Repository

## Executive Summary

The Brixxie repository implements a **dual-method OAuth 2.0 PKCE (Proof Key for Public Clients)** flow with a combination of:
1. **Encrypted signed tokens** (primary method for state/PKCE data)
2. **Cookie fallback** (secondary method for traditional flow)
3. **Client-side sessionStorage** (for access tokens)
4. **Server-side HttpOnly cookies** (for token management)

---

## 1. PKCE Code Generation & Management

### Frontend Implementation (Browser-side)

**Location**: `src/components/shared/utils/config/config.ts` (lines 145-210)

#### Code Verifier Generation
```typescript
function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);  // Cryptographically secure random
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```
- **Length**: 32 random bytes = ~43 characters (base64url encoded)
- **Charset**: Base64 URL-safe alphabet (`A-Z`, `a-z`, `0-9`, `-`, `_`)
- **Storage**: sessionStorage with key `oauth_code_verifier`
- **Expiry**: 10 minutes (600,000 ms)

#### Code Challenge Generation
```typescript
async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const base64 = btoa(String.fromCharCode(...hashArray));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```
- **Hash Algorithm**: SHA-256
- **Encoding**: Base64 URL-safe
- **Output**: ~43 characters
- **Method**: S256 (PKCE standard SHA-256)

#### CSRF Token Generation (State Parameter)
```typescript
function generateCSRFToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```
- **Length**: 32 random bytes
- **Purpose**: CSRF attack prevention (state parameter in OAuth flow)
- **Storage**: sessionStorage with key `oauth_csrf_token`

### Backend Implementation (Server-side)

**Location**: `api/oauth/start.js` (lines 1-150)

#### Server-side Code Generation
```javascript
function randomString(length = 64) {
    return base64URLEncode(crypto.randomBytes(length));
}

// Generation flow:
const code_verifier = randomString(64);  // 64 bytes of random data
const code_challenge = base64URLEncode(sha256(code_verifier));
const state_random = randomString(32);
```
- **Code Verifier**: 64 random bytes → ~86 characters (higher entropy than frontend)
- **Code Challenge**: SHA-256 hash of verifier, base64url encoded
- **State Token**: 32 random bytes

#### Encrypted PKCE Token (State Parameter)
```javascript
function createPKCEToken(code_verifier, state, client_id, redirect_uri) {
    const data = JSON.stringify({ 
        code_verifier, 
        state, 
        client_id, 
        redirect_uri, 
        ts: Date.now() 
    });
    const secret = process.env.OAUTH_SECRET || 'fallback-secret-change-in-production';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    const signature = base64URLEncode(hmac.digest());
    return `${base64URLEncode(Buffer.from(data))}.${signature}`;
}
```
- **Format**: `<base64url(JSON)>.<base64url(HMAC-SHA256)>`
- **Signed with**: `OAUTH_SECRET` environment variable
- **Payload includes**: code_verifier, state, client_id, redirect_uri, timestamp
- **Validation**: Signature verification + timestamp check (10-minute expiry)
- **Purpose**: Self-contained, tamper-proof PKCE state

---

## 2. OAuth Flow Endpoints & Configuration

### Authorization Initiation

**Endpoint**: `api/oauth/start.js` (GET)

**Query Parameters**:
- `client_id`: OAuth client ID (optional, falls back to env)
- `app_id`: Legacy Deriv app ID (optional)
- `redirect_uri`: Registered redirect URI (optional)
- `account`: Preferred account parameter (optional)

**Response**: Redirects to Deriv authorization endpoint
```
https://auth.deriv.com/oauth2/auth?
  response_type=code&
  client_id=33EmTMY5M3NMHve0SU8tY&
  redirect_uri=https://brixxie-theta.vercel.app/callback&
  scope=trade+account_manage&
  state=<ENCRYPTED_PKCE_TOKEN>&
  code_challenge=<SHA256_HASH>&
  code_challenge_method=S256
```

### Token Exchange

**Endpoint**: `api/token.js` (POST)

**Request Body**:
```javascript
{
    grant_type: 'authorization_code',
    code: <AUTH_CODE>,
    redirect_uri: <REGISTERED_URI>,
    code_verifier: <PKCE_CODE_VERIFIER>,
    client_id: <CLIENT_ID> // or app_id if using legacy
}
```

**Target URL**: `https://auth.deriv.com/oauth2/token`

**Response**: 
```json
{
    "access_token": "...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "...",
    "scope": "trade account_manage"
}
```

### OAuth Callback

**Endpoint**: `api/oauth/callback.js` (GET)

**Flow**:
1. Validates authorization code and state
2. Extracts PKCE data from:
   - Encrypted state token (preferred)
   - Query parameter code_verifier (frontend-initiated)
   - Cookies (fallback)
3. Exchanges code for token
4. Sets HttpOnly cookies with access/refresh tokens
5. Returns token data to client

**State Validation**:
- For token-based: Signature verification (HMAC-SHA256)
- For cookie-based: Direct state comparison
- Timestamp check: Must be < 10 minutes old

---

## 3. Headers & Authentication Configuration

### Authorization Headers

#### API Requests (Accounts & OTP)
**Location**: `src/services/derivws-accounts.service.ts`

```typescript
// Fetch accounts list
const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
        Authorization: `Bearer ${accessToken}`,
    },
});

// Fetch OTP for WebSocket URL
const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
        Authorization: `Bearer ${accessToken}`,
    },
});
```

#### Session Check Headers
**Location**: `api/oauth/session.js`

```javascript
const account_headers = {
    Authorization: `Bearer ${access_token}`,
    'Content-Type': 'application/json',
    ...(deriv_app_id ? { 'Deriv-App-ID': deriv_app_id } : {}),
};
```

**Headers**:
- `Authorization`: Bearer token from OAuth (required for all authenticated requests)
- `Deriv-App-ID`: Legacy app ID (optional, for Deriv routing)
- `Content-Type`: application/json or application/x-www-form-urlencoded

### Cookie Configuration for OAuth Flow

**Location**: `api/oauth/start.js` (lines 61-75)

```javascript
const getCookieOptions = req => {
    const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
    const secure = isProduction || forwardedProto === 'https';
    
    const cookieOpts = [`HttpOnly`, `Path=/`, `Max-Age=600`];
    
    // For OAuth cross-origin redirects, use SameSite=None with Secure
    if (secure) {
        cookieOpts.push('SameSite=None', 'Secure');
    } else {
        cookieOpts.push('SameSite=Lax');
    }
    return cookieOpts;
};
```

**Cookies Set During OAuth Flow**:
1. `oauth_code_verifier`: PKCE code verifier (Max-Age=600, HttpOnly)
2. `oauth_state`: CSRF state token (Max-Age=600, HttpOnly)
3. `oauth_pkce_token`: Encrypted PKCE token (Max-Age=600, HttpOnly)
4. `oauth_redirect_uri`: Redirect URI (Max-Age=600, HttpOnly)
5. `oauth_client_id` or `oauth_app_id`: OAuth/app ID (Max-Age=600, HttpOnly)

**Cookies Set After Token Exchange**:
1. `deriv_access_token`: Bearer token (Max-Age=3600, HttpOnly)
2. `deriv_refresh_token`: Refresh token (Max-Age=604800, HttpOnly)
3. `deriv_token_expires`: Token expiry timestamp (Max-Age=3600, HttpOnly)
4. `deriv_app_id`: App ID for routing (HttpOnly)
5. `logged_state`: Session indicator (non-HttpOnly)

---

## 4. Token Management & Storage

### Client-side Token Storage

**SessionStorage** (Client JavaScript):
```typescript
// Location: src/services/oauth-token-exchange.service.ts
const authInfo: AuthInfo = {
    access_token: data.access_token,
    token_type: data.token_type || 'bearer',
    expires_in: data.expires_in || 3600,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    scope: data.scope,
    refresh_token: data.refresh_token, // optional
};
sessionStorage.setItem('auth_info', JSON.stringify(authInfo));
```

**Key**: `auth_info`
**Expiry**: Based on `expires_in` value (typically 3600 seconds = 1 hour)

### Server-side Token Storage

**HttpOnly Cookies**:
- `deriv_access_token`: Contains the Bearer token
- `deriv_refresh_token`: For token refresh operations
- `deriv_token_expires`: Expiry timestamp in milliseconds
- Secure flag: Only set if HTTPS/production

### Token Refresh Flow

**Location**: `api/oauth/refresh.js`

```javascript
const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    ...(client_secret ? { client_secret } : {}),
});

const response = await fetch('https://auth.deriv.com/oauth2/token', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Trading-Bot/1.0',
    },
    body: params.toString(),
});
```

---

## 5. OAuth Domain Configuration

**Location**: `src/components/shared/utils/config/config.ts` (lines 8-45) & `brand.config.json`

### Domain Config Mapping
```typescript
const DOMAIN_CONFIG: Record<string, DomainConfig> = {
    'brixxie-theta.vercel.app': {
        clientId: '33EmTMY5M3NMHve0SU8tY',
        appId: '80058',
        redirectUri: 'https://brixxie-theta.vercel.app/callback',
        botsFolder: 'brixxie',
        includeLegacyAppIdInOAuth: true,
    },
};
```

### Brand Configuration
```json
{
    "platform": {
        "auth2_url": {
            "production": "https://auth.deriv.com/oauth2/",
            "staging": "https://auth.deriv.com/oauth2/"
        },
        "derivws": {
            "url": {
                "staging": "https://api.derivws.com/trading/v1/",
                "production": "https://api.derivws.com/trading/v1/"
            },
            "directories": {
                "options": "options/",
                "derivatives": "derivatives/"
            }
        }
    }
}
```

---

## 6. Account Management After OAuth

### Authenticated WebSocket URL Flow

**Location**: `src/services/derivws-accounts.service.ts`

1. **Fetch Accounts List**
   ```typescript
   static async fetchAccountsList(accessToken: string): Promise<DerivAccount[]> {
       const endpoint = `${baseURL}${optionsDir}accounts`;
       const response = await fetch(endpoint, {
           headers: { Authorization: `Bearer ${accessToken}` }
       });
       // Returns array of accounts with ID, balance, currency, account_type
   }
   ```

2. **Fetch OTP & WebSocket URL**
   ```typescript
   static async fetchOTPWebSocketURL(accessToken: string, accountId: string): Promise<string> {
       const endpoint = `${baseURL}${optionsDir}accounts/${accountId}/otp`;
       const response = await fetch(endpoint, {
           method: 'POST',
           headers: { Authorization: `Bearer ${accessToken}` }
       });
       // Returns: { data: { url: "wss://..." } }
   }
   ```

3. **Get Authenticated WebSocket URL**
   ```typescript
   static async getAuthenticatedWebSocketURL(accessToken: string): Promise<string> {
       // 1. Check sessionStorage for cached accounts
       // 2. If not found, fetch accounts list
       // 3. Resolve active account (from localStorage.active_loginid)
       // 4. Fetch OTP and WebSocket URL
       // 5. Return WebSocket URL with embedded OTP
   }
   ```

### Account Storage
```typescript
// Store in sessionStorage
sessionStorage.setItem('deriv_accounts', JSON.stringify(accounts));

// Store active account in localStorage
localStorage.setItem('active_loginid', firstAccount.account_id);
localStorage.setItem('account_type', isDemo ? 'demo' : 'real');
```

---

## 7. PKCE OAuth URL Generation (Frontend)

**Location**: `src/components/shared/utils/config/config.ts` (lines 288-350)

### generateOAuthURL() Function
```typescript
export async function generateOAuthURL(
    optionsOrPrompt?: OAuthURLOptions | string,
    domainConfig = getDomainConfig()
): Promise<string> {
    // 1. Generate CSRF token and store in sessionStorage
    const csrfToken = generateCSRFToken();
    storeCSRFToken(csrfToken);
    
    // 2. Generate PKCE code_verifier and code_challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    storeCodeVerifier(codeVerifier);
    
    // 3. Build OAuth URL with all parameters
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'trade account_manage',
        state: csrfToken,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    });
    
    // 4. Add optional parameters
    if (options.prompt) params.set('prompt', options.prompt);
    if (includeLegacyAppIdInOAuth && appId) params.set('app_id', appId);
    
    return `${hostname}auth?${params.toString()}`;
}
```

**Stored PKCE Data**:
- `oauth_code_verifier`: PKCE verifier (sessionStorage)
- `oauth_csrf_token`: CSRF token (sessionStorage)
- Both expire after 10 minutes

---

## 8. Callback Processing

**Location**: `src/hooks/useOAuthCallback.ts`

### Validation Steps
1. **Parse URL Parameters**: Extract `code`, `state`, error/error_description
2. **Parse Legacy Accounts**: Check for legacy OAuth response format
3. **CSRF Validation**: Verify state token matches stored CSRF token
4. **Code Validation**: Ensure authorization code is present
5. **Extract Parameters**: Get code, state from URL
6. **Call Token Exchange**: `OAuthTokenExchangeService.exchangeCodeForToken(code)`

### Token Exchange Service

**Location**: `src/services/oauth-token-exchange.service.ts` (lines 114-240)

```typescript
static async exchangeCodeForToken(code: string): Promise<TokenExchangeResponse> {
    // 1. Retrieve code_verifier from sessionStorage
    const codeVerifier = getCodeVerifier();
    
    // 2. Get client_id from domain config
    const { clientId } = getDomainConfig();
    const redirectUrl = getDomainConfig().redirectUri;
    
    // 3. Build token request
    const requestBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        redirect_uri: redirectUrl,
        code_verifier: codeVerifier,  // PKCE verification
    });
    
    // 4. POST to token endpoint
    const response = await fetch(`${baseURL}token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: requestBody.toString(),
    });
    
    // 5. Store token and fetch accounts
    if (data.access_token) {
        clearCodeVerifier();  // Clear PKCE verifier after use
        
        // Store auth info
        sessionStorage.setItem('auth_info', JSON.stringify(authInfo));
        
        // Fetch and store accounts
        const accounts = await DerivWSAccountsService.fetchAccountsList(data.access_token);
        
        // Initialize WebSocket with first account
        const firstAccount = accounts[0];
        localStorage.setItem('active_loginid', firstAccount.account_id);
        
        // Initialize API base with authenticated account
        const { api_base } = await import('@/external/bot-skeleton');
        await api_base.init(true);
    }
}
```

---

## 9. Session Management

**Location**: `api/oauth/session.js`

### Check Session Endpoint (GET)

**Purpose**: Verify if user is logged in and fetch current session details

**Response**:
```json
{
    "logged_in": true,
    "account_id": "VRT1234567",
    "account_type": "demo",
    "currency": "USD",
    "app_id": "80058",
    "access_token": "...",
    "accounts": [
        {
            "loginid": "VRT1234567",
            "currency": "USD",
            "account_type": "demo",
            "is_virtual": true,
            "balance": 10000
        }
    ]
}
```

### Logout Endpoint

**Location**: `api/oauth/logout.js` (POST)

**Clears Cookies**:
- `deriv_access_token`
- `deriv_refresh_token`
- `deriv_token_expires_at`
- `deriv_selected_account`
- `oauth_code_verifier`
- `oauth_state`
- `oauth_preferred_account`

---

## 10. Security Implementation Details

### PKCE Security
✅ **Code Verifier Generation**: Cryptographically secure random (32-64 bytes)
✅ **Challenge Method**: S256 (SHA-256 standard)
✅ **Verifier Size**: 43-86 characters (meets RFC 7636 requirement of 43-128)
✅ **Verification**: Strict comparison with HMAC-SHA256 signature

### CSRF Protection
✅ **State Parameter**: Cryptographically secure random (32 bytes)
✅ **State Validation**: Token comparison with timestamp check
✅ **Token Lifetime**: 10 minutes maximum

### Cookie Security
✅ **HttpOnly Flag**: Prevents XSS token theft
✅ **Secure Flag**: HTTPS-only in production
✅ **SameSite**: Strict (same-site only) or None (with Secure for cross-site OAuth)
✅ **Max-Age**: 600 seconds for PKCE params, 3600 for tokens

### Token Security
✅ **Access Token**: Stored in sessionStorage (cleared on page close)
✅ **Refresh Token**: Stored in HttpOnly cookie (server-only access)
✅ **Token Expiry**: Explicit expiry timestamp tracking
✅ **Bearer Token**: Used for all authenticated API requests

---

## 11. Special Configuration for Vercel Deployment

**Location**: `vercel.json` and `src/components/shared/utils/config/config.ts`

### Redirect Rewrite
```json
{
    "rewrites": [
        {
            "source": "/callback",
            "destination": "/api/oauth/callback"
        }
    ]
}
```

**Important**: Deriv OAuth is registered with `/callback` as the redirect URI, but Vercel rewrites it to `/api/oauth/callback`. The client always uses `/callback` as the registered redirect URI.

### Environment Variables
- `CLIENT_ID`: OAuth client ID (33EmTMY5M3NMHve0SU8tY)
- `REDIRECT_URI`: Registered callback URI
- `OAUTH_SECRET`: HMAC signing secret for PKCE tokens
- `DERIV_REDIRECT_URI`: Alternative redirect URI config

---

## 12. Summary Table

| Component | Location | Details |
|-----------|----------|---------|
| **Code Verifier** | Browser + Server | 32-64 bytes, base64url encoded |
| **Code Challenge** | Browser + Server | SHA-256(verifier), base64url |
| **CSRF Token** | Browser | 32-byte random, base64url |
| **Encrypted PKCE Token** | Server (API) | HMAC-SHA256 signed JSON |
| **Access Token** | sessionStorage | 3600s expiry |
| **Refresh Token** | HttpOnly Cookie | 7-day expiry |
| **OAuth Endpoint** | `https://auth.deriv.com/oauth2/` | Authorization + token URLs |
| **API Endpoint** | `https://api.derivws.com/trading/v1/` | Accounts & OTP endpoints |
| **Header Auth** | API requests | `Authorization: Bearer <token>` |
| **Session Check** | `api/oauth/session.js` | Returns login status & accounts |

---

## 13. Key Flows Diagram

### Authorization Flow
```
User Login
    ↓
generateOAuthURL()
    ├─ Generate code_verifier (32 bytes)
    ├─ Generate code_challenge (SHA-256)
    ├─ Generate state/CSRF token
    ├─ Store in sessionStorage
    └─ Redirect to https://auth.deriv.com/oauth2/auth?...
         ↓
    Deriv Login Page
         ↓
    Redirect with code & state
         ↓
api/oauth/callback
    ├─ Validate state
    ├─ Exchange code + verifier
    ├─ Store access_token in sessionStorage
    ├─ Store tokens in HttpOnly cookies
    ├─ Fetch accounts list
    └─ Return to app
         ↓
    App initialized with authenticated account
```

### Authenticated API Request Flow
```
App needs to call API
    ↓
Get access_token from sessionStorage
    ↓
Fetch with headers: { Authorization: "Bearer <token>" }
    ↓
DerivWS API
    ├─ Validates Bearer token
    └─ Returns account data / WebSocket URL
         ↓
    App updates UI with account info
```

---

## Conclusion

The Brixxie OAuth PKCE implementation is a **production-grade, security-focused** integration featuring:
- ✅ Modern PKCE OAuth 2.0 with SHA-256
- ✅ Dual fallback mechanisms (token + cookie)
- ✅ Secure sessionStorage + HttpOnly cookie combination
- ✅ Signed HMAC tokens for state verification
- ✅ Proper CSRF protection with timestamp validation
- ✅ Full account management with WebSocket authentication
- ✅ Token refresh mechanism for long sessions
