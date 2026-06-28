# OAuth 2.0 PKCE Implementation Guide

This guide documents the OAuth 2.0 with PKCE (Proof Key for Exchange) implementation in the Brixxie trading platform, based on analysis of the CashflowTraders reference implementation.

## Overview

PKCE (RFC 7636) is a security extension to OAuth 2.0 that prevents authorization code interception attacks in public/browser-based applications. It's mandatory for SPAs and highly recommended for all client applications.

### Key Benefits
- **Protection Against Authorization Code Interception**: Even if an attacker intercepts the auth code, they cannot use it without the code_verifier
- **No Client Secret Required**: Eliminates the need for shared secrets in public clients
- **Cross-Site Request Forgery (CSRF) Protection**: Combined with state parameter
- **Compliance**: Required by modern OAuth 2.0 best practices and spec

## PKCE Flow Sequence

```
┌─────────────┐                     ┌──────────────┐
│   Browser   │                     │ OAuth Server │
└────┬────────┘                     └──────┬───────┘
     │                                      │
     │ 1. Generate code_verifier (32 bytes) │
     │    & code_challenge (SHA-256 hash)   │
     │                                      │
     │ 2. Redirect to auth endpoint         │
     │    + code_challenge                  │
     │─────────────────────────────────────→│
     │                                      │
     │                      3. User authenticates
     │                      4. Returns auth code
     │←─────────────────────────────────────│
     │                                      │
     │ 5. Exchange code + code_verifier     │
     │─────────────────────────────────────→│
     │                                      │
     │ 6. Server validates code_verifier    │
     │    matches code_challenge            │
     │                                      │
     │           7. Returns access_token    │
     │←─────────────────────────────────────│
     │                                      │
```

## Implementation Details

### 1. Code Verifier Generation

**What it is:**
- A random string of 32 bytes (256 bits)
- Base64 URL-safe encoded to ~43 characters
- Cryptographically secure (using `crypto.getRandomValues()`)

**How it's generated:**
```typescript
// From cashflowtraders/src/components/shared/utils/config/config.ts
export const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
};
```

**Important:**
- Must be cryptographically random
- Must be stored securely (sessionStorage with expiry)
- Must be cleared after token exchange
- Never shared with the server during authorization request

### 2. Code Challenge Generation

**What it is:**
- SHA-256 hash of the code_verifier
- Base64 URL-safe encoded
- Sent to authorization server

**How it's generated:**
```typescript
export const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(hash);
};
```

**Why SHA-256 (S256)?**
- Protects against code_verifier exposure during transmission
- S256 is the recommended method in PKCE spec
- Plain text (plain) method is NOT recommended for SPAs

### 3. Authorization Request

**URL Format:**
```
{auth_endpoint}auth?
  scope=trade+account_manage
  &response_type=code
  &client_id={clientId}
  &redirect_uri={redirectUrl}
  &state={csrfToken}
  &code_challenge={codeChallenge}
  &code_challenge_method=S256
  &app_id={appId}
```

**From brixxie/src/components/shared/utils/config/config.ts:**
```typescript
let oauthUrl = `${hostname}auth?scope=${scopes}&response_type=code` +
  `&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}` +
  `&state=${csrfToken}&code_challenge=${codeChallenge}` +
  `&code_challenge_method=S256`;
```

**Key Parameters:**
| Parameter | Value | Purpose |
|-----------|-------|---------|
| `client_id` | From .env `CLIENT_ID` | Identifies the application |
| `redirect_uri` | Domain + callback path | Where to return after auth |
| `code_challenge` | SHA-256 hash | Server-side PKCE verification |
| `code_challenge_method` | S256 | SHA-256 method |
| `state` | 32-byte random CSRF token | CSRF attack prevention |
| `scope` | `trade+account_manage` | Requested permissions |
| `response_type` | `code` | Authorization Code flow |

### 4. Callback Handling

**What server receives:**
```
https://callback-url?code={authorization_code}&state={state}
```

**Client-side validation:**
```typescript
// Validate CSRF token matches
const storedToken = sessionStorage.getItem('oauth_csrf_token');
if (storedToken !== state) {
    throw new Error('Invalid CSRF token');
}

// Check token expiry (10 minutes)
const timestamp = sessionStorage.getItem('oauth_csrf_token_timestamp');
const tokenAge = Date.now() - parseInt(timestamp, 10);
if (tokenAge > 600000) {
    throw new Error('CSRF token expired');
}
```

### 5. Token Exchange

**Backend Endpoint:** `/api/token`

**Request Format:**
```json
POST /api/token
{
  "code": "{authorization_code}",
  "code_verifier": "{32_byte_random_string}",
  "redirect_uri": "{must_match_auth_request}",
  "client_id": "{clientId}"
}
```

**Backend Logic (api/token.ts):**
```typescript
const response = await fetch('https://auth.deriv.com/oauth2/token', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        code_verifier: codeVerifier,  // CRITICAL: Must match code_challenge
        redirect_uri: redirectUrl,     // CRITICAL: Must match auth request
        client_id: clientId,
    }).toString(),
});
```

**Why code_verifier in token exchange?**
- OAuth server validates: `SHA-256(code_verifier) === code_challenge`
- If they don't match, token exchange fails
- Prevents attacker from using stolen authorization code

**Response:**
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "scope": "trade account_manage"
}
```

### 6. Client-side Token Storage

**Storage Location:** sessionStorage

**Stored Data (auth_info):**
```json
{
  "access_token": "{bearer_token}",
  "token_type": "bearer",
  "expires_in": 3600,
  "expires_at": {unix_timestamp_ms},
  "scope": "trade account_manage",
  "refresh_token": "{refresh_token}"
}
```

**Expiry Calculation:**
```typescript
const authInfo: AuthInfo = {
  access_token: data.access_token,
  token_type: data.token_type || 'bearer',
  expires_in: data.expires_in || 3600,
  expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  scope: data.scope,
  refresh_token: data.refresh_token,
};

sessionStorage.setItem('auth_info', JSON.stringify(authInfo));
```

**Critical Cleanup:**
```typescript
// After successful token exchange
clearCodeVerifier(); // Remove from sessionStorage
clearCSRFToken();    // Remove from sessionStorage
```

## PKCE Storage Security

### What Gets Stored Where

| Item | Storage | Expiry | Access | Cleared When |
|------|---------|--------|--------|--------------|
| code_verifier | sessionStorage | 10 min | Frontend only | Token exchange success |
| code_challenge | URL only | — | Server reads once | After auth |
| CSRF token | sessionStorage | 10 min | Frontend only | Callback validation |
| access_token | sessionStorage | Calculated | Frontend + API calls | Manual logout |
| refresh_token | sessionStorage | 7 days | Frontend only | Manual logout |

### sessionStorage vs localStorage

**Why sessionStorage?**
```
✓ Cleared when tab/window closes
✓ Not accessible across domains
✓ Automatically isolated per-tab
✓ Perfect for short-lived OAuth tokens

✗ Lost on browser crash (acceptable for tokens)
✗ Not available across tabs (user re-auth needed)
```

**For persistent login**, implement refresh_token rotation:
1. Store refresh_token in HttpOnly cookie (server-side)
2. Use refresh_token to obtain new access_token before expiry
3. Implement automatic token refresh on `/api/token` call

## Header Authentication

### Request Headers

**Standard Authorization Header:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**From oauth-token-exchange.service.ts:**
```typescript
const token = OAuthTokenExchangeService.getAccessToken();
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

**Optional Legacy Header (Deriv API):**
```
Deriv-App-ID: {app_id}
```

### Header Validation

Before every API call:
```typescript
static getAccessToken(): string | null {
    const authInfo = this.getAuthInfo();
    
    // Check expiry before returning
    if (authInfo && Date.now() >= authInfo.expires_at) {
        this.clearAuthInfo();
        return null;  // Force re-authentication
    }
    
    return authInfo?.access_token || null;
}
```

## Configuration

### Environment Variables

```bash
# .env or .env.production
CLIENT_ID=your_oauth_client_id
APP_ID=your_legacy_app_id  # Optional
NODE_ENV=production         # Determines staging vs production URLs
```

### brand.config.json

```json
{
  "brand_domain": "www.profithub.co.ke",
  "platform": {
    "auth2_url": {
      "staging": "https://staging-auth.deriv.com/oauth2/",
      "production": "https://auth.deriv.com/oauth2/"
    },
    "app_id": "legacy_app_id_fallback"
  }
}
```

### Redirect URIs

**Must be registered with OAuth provider:**
- Production: `https://www.profithub.co.ke/`
- Development: `http://localhost:8080/`
- Vercel Preview: `https://your-project.vercel.app/`

**Critical:** Exact match including protocol and trailing slash

## Security Checklist

- [ ] Code verifier is cryptographically random (32 bytes)
- [ ] Code challenge uses SHA-256 (S256 method)
- [ ] CSRF token is validated before token exchange
- [ ] CSRF token has 10-minute expiry
- [ ] Code verifier is cleared after token exchange
- [ ] Tokens stored only in sessionStorage (not localStorage)
- [ ] Token expiry is validated before each API call
- [ ] Authorization header uses `Bearer {token}` format
- [ ] `redirect_uri` exactly matches registered URI
- [ ] HTTPS enforced in production
- [ ] HttpOnly cookies used for refresh_token (server-side storage)
- [ ] No tokens logged or exposed in error messages

## Common Issues & Solutions

### Issue: "invalid_grant" Token Exchange Error

**Causes:**
1. Code verifier doesn't match code_challenge: `SHA-256(verifier) ≠ challenge`
2. Redirect URI doesn't match auth request
3. Authorization code expired (usually 10 minutes)
4. Client ID mismatch

**Solution:**
```typescript
// Verify code_verifier exists
const codeVerifier = getCodeVerifier();
if (!codeVerifier) {
    throw new Error('Code verifier expired or not found');
}

// Verify redirect_uri matches exactly
const redirectUrl = isProd 
  ? `https://${brandConfig.brand_domain}/` 
  : `${protocol}//${host}/`;
```

### Issue: CSRF Token Mismatch

**Cause:**
- Attacker modified state parameter
- Different browser tab (tokens not shared)
- User refreshed during callback

**Solution:**
```typescript
export const validateCSRFToken = (token: string): boolean => {
    const storedToken = sessionStorage.getItem('oauth_csrf_token');
    const timestamp = sessionStorage.getItem('oauth_csrf_token_timestamp');
    
    if (!storedToken || !timestamp) {
        return false;
    }
    
    // Check token age
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > 600000) {
        sessionStorage.removeItem('oauth_csrf_token');
        return false;
    }
    
    return storedToken === token;
};
```

### Issue: Token Expires During Use

**Solution:**
Implement automatic token refresh:
```typescript
static async ensureValidToken(): Promise<string | null> {
    const authInfo = this.getAuthInfo();
    
    if (!authInfo) return null;
    
    // Refresh if expiring within 5 minutes
    if (Date.now() > authInfo.expires_at - 300000) {
        return await this.refreshAccessToken(authInfo.refresh_token);
    }
    
    return authInfo.access_token;
}
```

## Testing PKCE Flow

### Manual Testing

1. **Verify Code Challenge Generation:**
```javascript
// In browser console
const verifier = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0'; // 43 chars
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
console.log('Code Challenge:', challenge);
```

2. **Test OAuth Flow:**
- Clear sessionStorage
- Click login
- Verify code_verifier stored in sessionStorage (10 min expiry)
- Complete OAuth login
- Verify auth_info stored after callback
- Verify code_verifier cleared

3. **Verify Headers:**
```javascript
// Network tab check
// Authorization: Bearer eyJhbGc...
// Content-Type: application/json
```

### Automated Testing

```typescript
// Unit test example
describe('PKCE Flow', () => {
    it('should generate valid code_verifier and challenge', async () => {
        const verifier = generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);
        
        // Verify length
        expect(verifier.length).toBe(43);
        
        // Verify SHA-256 hash relationship
        const hash = crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        expect(challenge).toBe(base64UrlEncode(hash));
    });
    
    it('should validate CSRF token with expiry', () => {
        const token = generateCSRFToken();
        storeCSRFToken(token);
        
        expect(validateCSRFToken(token)).toBe(true);
        
        // Simulate 11 minutes passed
        sessionStorage.setItem('oauth_csrf_token_timestamp', String(Date.now() - 660000));
        expect(validateCSRFToken(token)).toBe(false);
    });
});
```

## Production Deployment Checklist

- [ ] Update `CLIENT_ID` in production environment
- [ ] Verify `brand_domain` is `www.profithub.co.ke`
- [ ] Verify redirect URIs registered with OAuth provider
- [ ] Test token exchange with production OAuth server
- [ ] Enable HTTPS (required for OAuth)
- [ ] Review token expiry handling
- [ ] Configure refresh_token rotation strategy
- [ ] Monitor OAuth errors in logging
- [ ] Implement token expiry monitoring/alerts
- [ ] Test account switching (logout + login)
- [ ] Verify CSRF protection in production

## References

- [RFC 7636 - PKCE](https://tools.ietf.org/html/rfc7636)
- [Deriv OAuth2 Documentation](https://api.deriv.com)
- [OWASP OAuth 2.0 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth_2_Cheat_Sheet.html)
- CashflowTraders Reference Implementation: `f:\New folder\brixxie\cashflowtraders`

## Related Files in Codebase

**OAuth Generation:**
- [src/components/shared/utils/config/config.ts](src/components/shared/utils/config/config.ts) - generateOAuthURL, PKCE helpers

**Token Exchange:**
- [api/token.ts](api/token.ts) - Backend proxy endpoint
- [src/services/oauth-token-exchange.service.ts](src/services/oauth-token-exchange.service.ts) - Client-side exchange logic

**Headers & Storage:**
- [src/stores/client-store.ts](src/stores/client-store.ts) - Token usage
- [src/services/derivws-accounts.service.ts](src/services/derivws-accounts.service.ts) - API request headers

**Configuration:**
- [brand.config.json](brand.config.json) - Domain & OAuth URLs
- [.env](.env) - Environment variables
