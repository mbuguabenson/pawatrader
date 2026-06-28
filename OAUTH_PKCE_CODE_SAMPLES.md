# OAuth PKCE Implementation Details & Code Samples

## Complete Code Walkthroughs

---

## 1. Frontend PKCE Generation Flow

### 1.1 generateOAuthURL() Function

**File**: `src/components/shared/utils/config/config.ts` (Lines 288-350)

```typescript
export async function generateOAuthURL(
    optionsOrPrompt?: OAuthURLOptions | string,
    domainConfig = getDomainConfig()
): Promise<string> {
    try {
        const { clientId, appId, redirectUri, includeLegacyAppIdInOAuth } = domainConfig;

        // Resolve options — supports the legacy string (prompt only) API
        const options: OAuthURLOptions =
            typeof optionsOrPrompt === 'string'
                ? { prompt: optionsOrPrompt }
                : optionsOrPrompt ?? {};

        // Always use PKCE flow — legacy app_id-only OAuth is removed
        const isProd = isProduction();
        const hostname = brandConfig.platform.auth2_url[isProd ? 'production' : 'staging'];

        if (hostname && clientId) {
            // 1. Generate CSRF token for state parameter
            const csrfToken = generateCSRFToken();
            storeCSRFToken(csrfToken);

            // 2. Generate PKCE code verifier and challenge
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);
            storeCodeVerifier(codeVerifier);

            // 3. Build OAuth URL with PKCE parameters
            const params = new URLSearchParams({
                response_type: 'code',
                client_id: clientId,
                redirect_uri: redirectUri,
                scope: 'trade account_manage',
                state: csrfToken,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
            });

            // Sign-up: show registration form instead of login
            if (options.prompt) {
                params.set('prompt', options.prompt);
            }

            // Legacy app_id — only included when opted-in via domain config
            if (includeLegacyAppIdInOAuth && appId) {
                params.set('app_id', appId);
            }

            // Partner attribution — all optional, only included when present
            if (options.affiliateToken) {
                params.set('t', options.affiliateToken);
            }
            if (options.utmCampaign) {
                params.set('utm_campaign', options.utmCampaign);
            }
            if (options.utmMedium) {
                params.set('utm_medium', options.utmMedium);
            }
            if (options.utmSource) {
                params.set('utm_source', options.utmSource);
            }

            // The auth2_url base ends with '/' and the canonical path is 'auth'
            return `${hostname}auth?${params.toString()}`;
        }
    } catch (error) {
        console.error('Error generating OAuth URL:', error);
    }

    // Fallback to hardcoded URLs if brand config fails
    return ``;
}
```

**What this does**:
1. Gets client ID and redirect URI from domain config
2. Generates cryptographically secure CSRF token (32 bytes)
3. Generates PKCE code verifier (32 bytes)
4. Generates PKCE code challenge using SHA-256
5. Stores both in sessionStorage for later validation
6. Builds final OAuth URL with all required parameters
7. Returns the Deriv authorization URL

### 1.2 Helper Functions

```typescript
// CSRF Token: 32-byte random value
function generateCSRFToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Code Verifier: 32-byte random value
function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Code Challenge: SHA-256 hash of verifier
async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const base64 = btoa(String.fromCharCode(...hashArray));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Storage functions
function storeCodeVerifier(verifier: string): void {
    sessionStorage.setItem('oauth_code_verifier', verifier);
    sessionStorage.setItem('oauth_code_verifier_timestamp', Date.now().toString());
}

function storeCSRFToken(token: string): void {
    sessionStorage.setItem('oauth_csrf_token', token);
    sessionStorage.setItem('oauth_csrf_token_timestamp', Date.now().toString());
}

// Retrieval functions
export function getCodeVerifier(): string | null {
    const verifier = sessionStorage.getItem('oauth_code_verifier');
    const timestamp = sessionStorage.getItem('oauth_code_verifier_timestamp');
    
    if (!verifier || !timestamp) return null;
    
    // Check 10-minute expiry
    const verifierAge = Date.now() - parseInt(timestamp, 10);
    if (verifierAge > 600000) {
        sessionStorage.removeItem('oauth_code_verifier');
        sessionStorage.removeItem('oauth_code_verifier_timestamp');
        return null;
    }
    
    return verifier;
}

export function validateCSRFToken(token: string): boolean {
    const storedToken = sessionStorage.getItem('oauth_csrf_token');
    const timestamp = sessionStorage.getItem('oauth_csrf_token_timestamp');
    
    if (!storedToken || !timestamp) return false;
    if (storedToken !== token) return false;
    
    // Check 10-minute expiry
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > 600000) {
        sessionStorage.removeItem('oauth_csrf_token');
        sessionStorage.removeItem('oauth_csrf_token_timestamp');
        return false;
    }
    
    return true;
}
```

---

## 2. Backend PKCE Token Creation

### 2.1 api/oauth/start.js - Authorization Initiation

**File**: `api/oauth/start.js` (Lines 1-150)

```javascript
import crypto from 'crypto';

// Base64 URL encoding (removes padding, replaces +/ with -_)
function base64URLEncode(buffer) {
    return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Base64 URL decoding (restores +/ and adds padding)
function base64URLDecode(str) {
    let s = str.replace(/\-/g, '+').replace(/_/g, '/');
    switch (s.length % 4) {
        case 0: break;
        case 2: s += '=='; break;
        case 3: s += '='; break;
        default: throw new Error('Invalid base64url string');
    }
    return Buffer.from(s, 'base64');
}

// SHA-256 hash
function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}

// Generate random string (N bytes → base64url encoded)
function randomString(length = 64) {
    return base64URLEncode(crypto.randomBytes(length));
}

// Create encrypted PKCE token (signed with HMAC-SHA256)
function createPKCEToken(code_verifier, state, client_id, redirect_uri) {
    const data = JSON.stringify({ 
        code_verifier,    // PKCE verifier
        state,            // CSRF state
        client_id,        // OAuth client ID
        redirect_uri,     // Registered callback URI
        ts: Date.now()    // Timestamp for expiry check
    });
    
    // Sign with HMAC-SHA256
    const secret = process.env.OAUTH_SECRET || 'fallback-secret-change-in-production';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    const signature = base64URLEncode(hmac.digest());
    
    // Return: base64url(JSON).base64url(SIGNATURE)
    return `${base64URLEncode(Buffer.from(data))}.${signature}`;
}

// Verify and decrypt PKCE token
function verifyPKCEToken(token) {
    try {
        if (!token) return null;
        
        // Split token into data and signature
        const [dataB64, signature] = token.split('.');
        const dataBuffer = base64URLDecode(dataB64);
        const data = JSON.parse(dataBuffer.toString());
        
        // Verify signature
        const secret = process.env.OAUTH_SECRET || 'fallback-secret-change-in-production';
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(JSON.stringify(data));
        const expectedSig = base64URLEncode(hmac.digest());
        
        if (signature !== expectedSig) return null;  // Signature mismatch
        
        // Verify token is not older than 10 minutes
        if (Date.now() - data.ts > 600000) return null;  // Expired
        
        return data;  // Return decrypted PKCE data
    } catch (err) {
        return null;  // Parsing error
    }
}

// Cookie options based on environment
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

// Main handler
export default async function handler(req, res) {
    // Only GET supported: redirect to the Deriv authorization endpoint
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const query = req.query || {};

        // Use client_id passed as query or fallback to env var
        const client_id = normalizeValue(
            query.client_id ||
            process.env.DERIV_OAUTH_CLIENT_ID ||
            process.env.OAUTH_CLIENT_ID ||
            process.env.CLIENT_ID
        );
        
        // Alternative: legacy app_id
        const app_id = normalizeValue(
            query.app_id ||
            process.env.APP_ID ||
            process.env.OAUTH_LEGACY_APP_ID ||
            process.env.DERIV_LEGACY_APP_ID
        );
        
        // Redirect URI MUST exactly match registered URI
        const redirect_uri = normalizeValue(
            query.redirect_uri ||
            process.env.DERIV_REDIRECT_URI ||
            process.env.OAUTH_REDIRECT_URI ||
            process.env.REDIRECT_URI ||
            'https://brixxie-theta.vercel.app/callback'
        );

        if ((!client_id && !app_id) || !redirect_uri) {
            return res.status(500).json({ 
                error: 'Missing server configuration for client_id or app_id, or redirect_uri' 
            });
        }

        const preferred_account = query.account || query.preferred_account || '';

        // ===== PKCE GENERATION =====
        // 1. Generate 64-byte random code verifier
        const code_verifier = randomString(64);  // 64 bytes → ~86 characters
        
        // 2. Generate code challenge (SHA-256 of verifier)
        const code_challenge = base64URLEncode(sha256(code_verifier));
        
        // 3. Generate 32-byte random state
        const state_random = randomString(32);
        
        // 4. Create encrypted token containing all PKCE data
        const pkceToken = createPKCEToken(code_verifier, state_random, client_id, redirect_uri);
        
        // 5. Use the encrypted token as the OAuth state parameter
        // This is returned by Deriv after user authentication
        const state = pkceToken;

        // ===== COOKIE SETUP =====
        // Set cookies as fallback for traditional flow
        const cookieOpts = getCookieOptions(req);
        const useClientId = Boolean(client_id);
        const useAppId = !useClientId && Boolean(app_id);

        const cookies = [
            // PKCE verifier (fallback storage)
            `oauth_code_verifier=${encodeURIComponent(code_verifier)}; ${cookieOpts.join('; ')}`,
            // State token (fallback storage)
            `oauth_state=${encodeURIComponent(state_random)}; ${cookieOpts.join('; ')}`,
            // Encrypted PKCE token (preferred method)
            `oauth_pkce_token=${encodeURIComponent(pkceToken)}; ${cookieOpts.join('; ')}`,
            // Redirect URI (for validation)
            `oauth_redirect_uri=${encodeURIComponent(redirect_uri)}; ${cookieOpts.join('; ')}`,
        ];

        if (useClientId) {
            cookies.push(`oauth_client_id=${encodeURIComponent(client_id)}; ${cookieOpts.join('; ')}`);
        } else if (useAppId) {
            cookies.push(`oauth_app_id=${encodeURIComponent(app_id)}; ${cookieOpts.join('; ')}`);
        }

        if (preferred_account) {
            cookies.push(`oauth_preferred_account=${encodeURIComponent(preferred_account)}; ${cookieOpts.join('; ')}`);
        }

        // Set all cookies in response
        res.setHeader('Set-Cookie', cookies);

        console.log('[OAuth Start] Cookies header:', {
            count: cookies.length,
            clientId: useClientId ? 'set' : 'not-set',
            appId: useAppId ? 'set' : 'not-set',
        });

        // ===== AUTHORIZATION REDIRECT =====
        // Build Deriv OAuth URL
        const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?` +
            `response_type=code` +
            `&client_id=${encodeURIComponent(client_id || app_id)}` +
            `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
            `&scope=${encodeURIComponent('read write')}` +
            `&state=${encodeURIComponent(state)}` +
            `&code_challenge=${encodeURIComponent(code_challenge)}` +
            `&code_challenge_method=S256`;

        console.log('[OAuth Start] Redirecting to:', {
            hasCodeChallenge: !!code_challenge,
            hasState: !!state,
            clientId: !!client_id,
            appId: !!app_id,
        });

        res.status(302).redirect(oauthUrl);
    } catch (error) {
        console.error('[OAuth Start] Error:', error);
        res.status(500).json({
            error: 'oauth_start_failed',
            error_description: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
```

---

## 3. Token Exchange

### 3.1 api/token.js - Token Exchange Handler

**File**: `api/token.js` (Complete)

```javascript
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse request body
        const body = typeof req.body === 'string' 
            ? Object.fromEntries(new URLSearchParams(req.body)) 
            : req.body;
        
        // Extract PKCE parameters
        const code = body.code;
        const code_verifier = body.code_verifier;
        
        // Get client ID from body or environment
        const client_id =
            body.client_id ||
            process.env.DERIV_OAUTH_CLIENT_ID ||
            process.env.OAUTH_CLIENT_ID ||
            process.env.CLIENT_ID;
        
        // Get app ID from body or environment
        const app_id =
            body.app_id ||
            process.env.APP_ID ||
            process.env.OAUTH_LEGACY_APP_ID ||
            process.env.DERIV_LEGACY_APP_ID;
        
        // Get redirect URI from body or environment
        const redirect_uri =
            body.redirect_uri ||
            process.env.DERIV_REDIRECT_URI ||
            process.env.OAUTH_REDIRECT_URI ||
            process.env.REDIRECT_URI;

        // Validate required parameters
        if (!code || !code_verifier || !redirect_uri || (!client_id && !app_id)) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Build token endpoint URL
        const tokenBaseUrl = process.env.AUTH_BASE_URL || 'https://auth.deriv.com';
        const tokenPath = process.env.TOKEN_ENDPOINT_PATH || '/oauth2/token';
        const tokenUrl = `${tokenBaseUrl.replace(/\/$/, '')}${tokenPath}`;
        
        // Build token request body with PKCE
        const tokenRequestBody = {
            grant_type: 'authorization_code',
            code,
            redirect_uri,
            code_verifier,  // PKCE verification
        };
        
        // Use client_id or app_id (prefer client_id for PKCE)
        if (client_id) {
            tokenRequestBody.client_id = client_id;
        } else if (app_id) {
            tokenRequestBody.app_id = app_id;
        }

        // Exchange code for token
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(tokenRequestBody).toString(),
        });

        const text = await response.text();
        const tokenData = text ? JSON.parse(text) : {};
        
        // Set tokens in HttpOnly cookies
        const isProd = process.env.NODE_ENV === 'production';
        const cookieOpts = ['HttpOnly', 'Path=/', 'SameSite=Lax'];
        if (isProd) {
            cookieOpts.push('Secure');
        }

        const setCookies = [];
        
        // Store access token
        if (tokenData.access_token) {
            const maxAge = Number(tokenData.expires_in) || 3600;
            setCookies.push(
                `deriv_access_token=${encodeURIComponent(tokenData.access_token)}; ${cookieOpts.join('; ')}; Max-Age=${maxAge}`
            );
            setCookies.push(
                `deriv_token_expires=${Date.now() + maxAge * 1000}; ${cookieOpts.join('; ')}`
            );
        }

        // Store refresh token
        if (tokenData.refresh_token) {
            setCookies.push(
                `deriv_refresh_token=${encodeURIComponent(tokenData.refresh_token)}; ${cookieOpts.join('; ')}; Max-Age=604800`
            );
        }

        // Store app ID for routing
        const appId = app_id || process.env.DERIV_LEGACY_APP_ID || process.env.APP_ID || process.env.OAUTH_LEGACY_APP_ID;
        if (appId) {
            setCookies.push(`deriv_app_id=${encodeURIComponent(appId)}; ${cookieOpts.join('; ')}`);
        }

        // Set session indicator
        setCookies.push(
            `logged_state=true; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}`
        );

        if (setCookies.length) {
            res.setHeader('Set-Cookie', setCookies);
        }

        // Return token data to client
        res.status(response.status).json(tokenData);
    } catch (error) {
        return res.status(500).json({
            error: 'token_exchange_failed',
            error_description: error instanceof Error ? error.message : 'Unknown token exchange error',
        });
    }
}
```

---

## 4. Token Exchange Service (Frontend)

### 4.1 src/services/oauth-token-exchange.service.ts

**Key methods**:

```typescript
export class OAuthTokenExchangeService {
    /**
     * Exchange authorization code for access token
     * This is called after OAuth callback
     */
    static async exchangeCodeForToken(code: string): Promise<TokenExchangeResponse> {
        try {
            const baseURL = this.getOAuth2BaseURL();
            const tokenEndpoint = `${baseURL}token`;

            // Retrieve the PKCE code verifier from sessionStorage
            const codeVerifier = getCodeVerifier();

            if (!codeVerifier) {
                ErrorLogger.error('OAuth', 'PKCE code verifier not found or expired');
                return {
                    error: 'invalid_request',
                    error_description:
                        'PKCE code verifier not found or expired. Please restart the authentication flow.',
                };
            }

            // Get clientId from domain config
            const { clientId } = getDomainConfig();
            if (!clientId) {
                ErrorLogger.error('OAuth', 'CLIENT_ID not configured');
                return {
                    error: 'invalid_client',
                    error_description: 'CLIENT_ID is not configured.',
                };
            }

            // Get redirect URI
            const redirectUrl = getDomainConfig().redirectUri;

            // Build token request with PKCE
            const requestBody = new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: clientId,
                redirect_uri: redirectUrl,
                code_verifier: codeVerifier,  // PKCE verification
            });

            // POST to token endpoint
            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                credentials: 'include',  // Include cookies
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: requestBody.toString(),
            });

            const data: TokenExchangeResponse = await response.json();

            // Check for errors
            if (data.error) {
                ErrorLogger.error('OAuth', `Token exchange error: ${data.error}`, {
                    error: data.error,
                    description: data.error_description,
                });
                return {
                    error: data.error,
                    error_description: data.error_description,
                };
            }

            // Success - store token and fetch accounts
            if (data.access_token) {
                // Clear the code verifier after successful exchange
                clearCodeVerifier();
                
                // Store authentication info in sessionStorage
                const authInfo: AuthInfo = {
                    access_token: data.access_token,
                    token_type: data.token_type || 'bearer',
                    expires_in: data.expires_in || 3600,
                    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
                    scope: data.scope,
                };

                // Include refresh token if provided
                if (data.refresh_token) {
                    authInfo.refresh_token = data.refresh_token;
                }

                // Store token info
                sessionStorage.setItem('auth_info', JSON.stringify(authInfo));

                // Fetch accounts using the new token
                try {
                    const { DerivWSAccountsService } = await import('./derivws-accounts.service');
                    const accounts = await DerivWSAccountsService.fetchAccountsList(data.access_token);

                    if (accounts && accounts.length > 0) {
                        // Store accounts
                        DerivWSAccountsService.storeAccounts(accounts);

                        // Set first account as active
                        const firstAccount = accounts[0];
                        localStorage.setItem('active_loginid', firstAccount.account_id);
                        localStorage.setItem('account_type', 
                            firstAccount.account_id.startsWith('VRT') ? 'demo' : 'real'
                        );

                        ErrorLogger.info('OAuth', 'Accounts fetched and stored', {
                            loginid: firstAccount.account_id,
                        });

                        // Initialize WebSocket with authenticated account
                        const { api_base } = await import('@/external/bot-skeleton');
                        await api_base.init(true);
                    } else {
                        ErrorLogger.error('OAuth', 'No accounts returned after token exchange');
                        this.clearAuthInfo();
                        return {
                            error: 'no_accounts',
                            error_description: 'No accounts available after authentication',
                        };
                    }
                } catch (error) {
                    ErrorLogger.error('OAuth', 'Error fetching accounts', error);
                    this.clearAuthInfo();
                    return {
                        error: 'account_fetch_failed',
                        error_description: 
                            error instanceof Error ? error.message : 'Failed to fetch accounts',
                    };
                }
            }

            return data;
        } catch (error: unknown) {
            ErrorLogger.error('OAuth', 'Token exchange network error', error);
            return {
                error: 'network_error',
                error_description: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get stored authentication info
     */
    static getAuthInfo(): AuthInfo | null {
        try {
            const authInfoStr = sessionStorage.getItem('auth_info');
            if (!authInfoStr) return null;

            const authInfo: AuthInfo = JSON.parse(authInfoStr);

            // Check if token is expired
            if (authInfo.expires_at && Date.now() >= authInfo.expires_at) {
                this.clearAuthInfo();
                return null;
            }

            return authInfo;
        } catch (error) {
            ErrorLogger.error('OAuth', 'Error parsing auth_info', error);
            return null;
        }
    }

    /**
     * Get current access token
     */
    static getAccessToken(): string | null {
        const authInfo = this.getAuthInfo();
        return authInfo?.access_token || null;
    }

    /**
     * Check if user is authenticated
     */
    static isAuthenticated(): boolean {
        const authInfo = this.getAuthInfo();
        return authInfo !== null && !!authInfo.access_token;
    }
}
```

---

## 5. Making Authenticated API Requests

### 5.1 Fetching Accounts with Bearer Token

**File**: `src/services/derivws-accounts.service.ts` (Lines 121-175)

```typescript
static async fetchAccountsList(accessToken: string): Promise<DerivAccount[]> {
    // If there's already a fetch in progress, return that promise
    if (this.accountsFetchPromise) {
        return this.accountsFetchPromise;
    }

    // Create new fetch promise and cache it
    this.accountsFetchPromise = (async () => {
        try {
            const baseURL = this.getDerivWSBaseURL();
            const OptionsDir = brandConfig.platform.derivws.directories.options;
            const endpoint = `${baseURL}${OptionsDir}accounts`;

            // Fetch with Bearer token authorization
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,  // OAuth token
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch accounts: ${response.status} ${response.statusText}`);
            }

            const data: AccountsResponse = await response.json();
            const accounts = data?.data || [];

            if (accounts.length === 0) {
                console.warn('[DerivWS] No accounts found in response');
            }

            // Store accounts in sessionStorage
            this.storeAccounts(accounts);
            return accounts;
        } catch (error) {
            console.error('[DerivWS] Error fetching accounts:', error);
            this.accountsFetchPromise = null;  // Clear cache on error
            throw error;
        } finally {
            // Clear the promise after completion
            setTimeout(() => {
                this.accountsFetchPromise = null;
            }, 100);
        }
    })();

    return this.accountsFetchPromise;
}
```

### 5.2 Fetching OTP & WebSocket URL

```typescript
static async fetchOTPWebSocketURL(accessToken: string, accountId: string): Promise<string> {
    const cacheKey = `${accountId}`;

    if (this.otpFetchPromises.has(cacheKey)) {
        return this.otpFetchPromises.get(cacheKey)!;
    }

    const otpPromise = (async () => {
        try {
            const baseURL = this.getDerivWSBaseURL();
            const optionsDir = brandConfig.platform.derivws.directories.options;
            const endpoint = `${baseURL}${optionsDir}accounts/${accountId}/otp`;

            // Fetch OTP with Bearer token
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,  // OAuth token
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch OTP: ${response.status} ${response.statusText}`);
            }

            const otpResponse: OTPResponse = await response.json();
            const websocketURL = otpResponse.data.url;

            if (!websocketURL) {
                throw new Error('WebSocket URL not found in OTP response');
            }
            
            return websocketURL;
        } catch (error) {
            console.error('[DerivWS] Error fetching OTP:', error);
            this.otpFetchPromises.delete(cacheKey);
            throw error;
        } finally {
            setTimeout(() => {
                this.otpFetchPromises.delete(cacheKey);
            }, 100);
        }
    })();

    this.otpFetchPromises.set(cacheKey, otpPromise);
    return otpPromise;
}
```

---

## 6. Domain Configuration

### 6.1 src/components/shared/utils/config/config.ts

```typescript
interface DomainConfig {
    clientId: string;        // OAuth PKCE CLIENT_ID
    appId: string;           // Deriv APP_ID (for WebSocket & legacy)
    redirectUri: string;     // Registered OAuth redirect URI
    botsFolder: string;      // Public folder for bots
    includeLegacyAppIdInOAuth: boolean;  // Include app_id in OAuth URL
}

const DEFAULT_DOMAIN_CONFIG: DomainConfig = {
    clientId: process.env.CLIENT_ID || '33EmTMY5M3NMHve0SU8tY',
    appId: process.env.APP_ID || '80058',
    redirectUri:
        process.env.REDIRECT_URI ||
        process.env.DERIV_REDIRECT_URI ||
        process.env.OAUTH_REDIRECT_URI ||
        `${window.location.origin}/callback`,
    botsFolder: process.env.BOTS_FOLDER || 'brixxie',
    includeLegacyAppIdInOAuth: true,
};

export const DOMAIN_CONFIG: Record<string, DomainConfig> = {
    'brixxie-theta.vercel.app': {
        clientId: '33EmTMY5M3NMHve0SU8tY',
        appId: '80058',
        redirectUri: 'https://brixxie-theta.vercel.app/callback',
        botsFolder: 'brixxie',
        includeLegacyAppIdInOAuth: true,
    },
};

/**
 * Returns domain config for current hostname
 * Falls back to env vars for localhost/dev
 */
export function getDomainConfig(): DomainConfig {
    const hostname = window.location.hostname;
    const domainConfig = getDomainConfigForHost(hostname);
    if (domainConfig) return domainConfig;
    return DEFAULT_DOMAIN_CONFIG;
}
```

---

## 7. Callback Handling

### 7.1 useOAuthCallback Hook

**File**: `src/hooks/useOAuthCallback.ts`

```typescript
export function useOAuthCallback(): OAuthCallbackResult {
    const [result, setResult] = useState<Omit<OAuthCallbackResult, 'cleanupURL'>>({
        isProcessing: true,
        isValid: false,
        params: {
            code: null,
            state: null,
            error: null,
            error_description: null,
        },
        legacyAccounts: [],
        error: null,
    });

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);

        // Check for OAuth callback parameters
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const error_description = urlParams.get('error_description');

        const isOAuthCallback = code !== null || error !== null || state !== null;

        if (!isOAuthCallback) {
            setResult({
                isProcessing: false,
                isValid: false,
                params: { code: null, state: null, error: null, error_description: null },
                legacyAccounts: [],
                error: null,
            });
            return;
        }

        if (error) {
            console.error('OAuth error:', error, error_description);
            setResult({
                isProcessing: false,
                isValid: false,
                params: { code, state, error, error_description },
                legacyAccounts: [],
                error: error_description || error,
            });
            cleanupURL();
            return;
        }

        if (!state) {
            console.error('[OAuth] Missing state parameter');
            clearAuthData();
            setResult({
                isProcessing: false,
                isValid: false,
                params: { code, state, error, error_description },
                legacyAccounts: [],
                error: 'Missing state parameter - potential security threat',
            });
            window.location.replace(window.location.origin);
            return;
        }

        // Validate CSRF token
        if (!validateCSRFToken(state)) {
            console.error('[OAuth] CSRF token validation failed');
            clearAuthData();
            setResult({
                isProcessing: false,
                isValid: false,
                params: { code, state, error, error_description },
                legacyAccounts: [],
                error: 'CSRF token validation failed',
            });
            return;
        }

        clearCSRFToken();

        if (!code) {
            console.error('[OAuth] Missing authorization code');
            setResult({
                isProcessing: false,
                isValid: false,
                params: { code, state, error, error_description },
                legacyAccounts: [],
                error: 'Missing authorization code',
            });
            cleanupURL();
            return;
        }

        // Valid OAuth callback
        setResult({
            isProcessing: false,
            isValid: true,
            params: { code, state, error, error_description },
            legacyAccounts: [],
            error: null,
        });
    }, [cleanupURL]);

    return {
        ...result,
        cleanupURL,
    };
}
```

---

## 8. Complete Example: Using OAuth in a React Component

```typescript
import { useEffect, useState } from 'react';
import { generateOAuthURL, OAuthTokenExchangeService } from '@/components/shared';
import { useOAuthCallback } from '@/hooks/useOAuthCallback';

export function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const oauthCallback = useOAuthCallback();

    // Handle login button click
    const handleLogin = async () => {
        setIsLoading(true);
        try {
            const oauthUrl = await generateOAuthURL();  // Generate PKCE URL
            window.location.replace(oauthUrl);  // Redirect to Deriv
        } catch (error) {
            console.error('Failed to generate OAuth URL:', error);
            setIsLoading(false);
        }
    };

    // Handle signup button click
    const handleSignup = async () => {
        setIsLoading(true);
        try {
            const oauthUrl = await generateOAuthURL('registration');  // Show signup form
            window.location.replace(oauthUrl);
        } catch (error) {
            console.error('Failed to generate OAuth URL:', error);
            setIsLoading(false);
        }
    };

    // Check if we're processing OAuth callback
    useEffect(() => {
        if (!oauthCallback.isValid) return;

        // Exchange code for token
        OAuthTokenExchangeService.exchangeCodeForToken(oauthCallback.params.code!)
            .then(result => {
                if (result.access_token) {
                    // Success - navigate to app
                    window.location.replace('/');
                } else if (result.error) {
                    // Show error
                    console.error('OAuth error:', result.error_description);
                }
            });
    }, [oauthCallback.isValid]);

    if (oauthCallback.isProcessing) {
        return <div>Processing OAuth callback...</div>;
    }

    return (
        <div>
            <button onClick={handleLogin} disabled={isLoading}>
                {isLoading ? 'Redirecting...' : 'Login'}
            </button>
            <button onClick={handleSignup} disabled={isLoading}>
                {isLoading ? 'Redirecting...' : 'Sign Up'}
            </button>
            {oauthCallback.error && (
                <div style={{ color: 'red' }}>
                    Error: {oauthCallback.error}
                </div>
            )}
        </div>
    );
}
```

---

## 9. Environment Variables Required

```bash
# OAuth Configuration
CLIENT_ID=33EmTMY5M3NMHve0SU8tY
REDIRECT_URI=https://brixxie-theta.vercel.app/callback
DERIV_REDIRECT_URI=https://brixxie-theta.vercel.app/callback
OAUTH_REDIRECT_URI=https://brixxie-theta.vercel.app/callback

# Legacy Deriv App ID (optional, for routing)
APP_ID=80058
DERIV_LEGACY_APP_ID=80058
OAUTH_LEGACY_APP_ID=80058

# PKCE Token Signing Secret
OAUTH_SECRET=your-secure-random-string-here-change-in-production

# Optional: Auth server override
AUTH_BASE_URL=https://auth.deriv.com
TOKEN_ENDPOINT_PATH=/oauth2/token
```

---

## Summary

This implementation provides:
- ✅ **Secure PKCE flow** with 64-byte server-side random verifiers
- ✅ **Encrypted PKCE tokens** with HMAC-SHA256 signatures
- ✅ **CSRF protection** with 32-byte state tokens
- ✅ **HttpOnly cookies** preventing XSS token theft
- ✅ **Bearer token authorization** for all API requests
- ✅ **Account management** with WebSocket authentication
- ✅ **Token refresh** mechanism for long sessions
- ✅ **Fallback mechanisms** for traditional OAuth flows
