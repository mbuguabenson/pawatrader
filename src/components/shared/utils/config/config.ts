import { getPendingApiToken } from '@/utils/api-token-permissions';
import brandConfig from '@/../brand.config.json';

// =============================================================================
// Domain Configuration Map
// Maps each hostname to its specific Deriv APP_ID, OAuth CLIENT_ID, and the
// exact redirect URI registered in that OAuth app.
// =============================================================================

interface DomainConfig {
    clientId: string; // OAuth 2.0 CLIENT_ID (new OAuth app)
    appId: string; // Legacy Deriv APP_ID for intelligent platform routing
    redirectUri: string; // MUST match the redirect URL registered in the OAuth app exactly
    botsFolder: string; // Public folder used by Best Bots XML loading for this domain
    includeLegacyAppIdInOAuth: boolean; // Only enable when the legacy app redirects to this domain
    useLegacyOAuthLogin: boolean; // Use old OAuth app_id login when OAuth2 client setup is not valid yet
}

const DEFAULT_BOTS_FOLDER = 'brixxie';
const DEFAULT_DOMAIN_CONFIG: DomainConfig = {
    clientId: process.env.CLIENT_ID || '33EmTMY5M3NMHve0SU8tY',
    appId: process.env.APP_ID || '71937',
    redirectUri: process.env.REDIRECT_URI || `${window.location.origin}/`,
    botsFolder: process.env.BOTS_FOLDER || DEFAULT_BOTS_FOLDER,
    includeLegacyAppIdInOAuth: true,
    useLegacyOAuthLogin: true,
};

export const DOMAIN_CONFIG: Record<string, DomainConfig> = {
    'brixxie-theta.vercel.app': {
        clientId: '33EmTMY5M3NMHve0SU8tY',
        appId: '71937',
        redirectUri: 'https://brixxie-theta.vercel.app/',
        botsFolder: 'brixxie',
        includeLegacyAppIdInOAuth: true,
        useLegacyOAuthLogin: true,
    },
};

export function getDomainConfigForHost(hostname: string): DomainConfig | undefined {
    return DOMAIN_CONFIG[hostname];
}

/**
 * Returns the DomainConfig for the current hostname.
 * Falls back to env vars (for local / Replit dev) when the hostname is not
 * listed in DOMAIN_CONFIG.
 */
export function getDomainConfig(): DomainConfig {
    const hostname = window.location.hostname;
    const domainConfig = getDomainConfigForHost(hostname);
    if (domainConfig) {
        return domainConfig;
    }
    // Fallback — used on localhost and dev domains
    return DEFAULT_DOMAIN_CONFIG;
}

export function getCurrentProductionDomain(): string | undefined {
    return Object.keys(DOMAIN_CONFIG).find(domain => window.location.hostname === domain);
}

export function isProduction(): boolean {
    if (process.env.APP_ENV === 'production') return true;
    const hostname = window.location.hostname;
    return !!DOMAIN_CONFIG[hostname];
}

export function isLocal(): boolean {
    return /localhost(:\d+)?$/i.test(window.location.hostname);
}

// =============================================================================
// Helper Functions
// =============================================================================

const getDefaultServerURL = (): string => {
    const isProd = isProduction();
    const wsUrl = `${brandConfig.platform.derivws.url[isProd ? 'production' : 'staging']}options/ws/public`;
    return wsUrl;
};

const getLegacyServerURL = (): string => {
    const { appId } = getDomainConfig();
    return `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`;
};

/**
 * Gets the WebSocket URL using the appropriate authentication flow
 */
export async function getSocketURL(): Promise<string> {
    try {
        const { OAuthTokenExchangeService } = await import('@/services/oauth-token-exchange.service');
        const { DerivWSAccountsService } = await import('@/services/derivws-accounts.service');

        // Check PKCE OAuth first (new platform users)
        const authInfo = OAuthTokenExchangeService.getAuthInfo();
        if (authInfo?.access_token) {
            console.log('[getSocketURL] PKCE user detected - fetching authenticated WebSocket URL');
            const wsUrl = await DerivWSAccountsService.getAuthenticatedWebSocketURL(authInfo.access_token);
            return wsUrl;
        }

        // Check for legacy token in localStorage (legacy platform users)
        const accountsList_raw = localStorage.getItem('accountsList');
        const pendingApiToken = getPendingApiToken();
        if (pendingApiToken) {
            const legacyWsUrl = getLegacyServerURL();
            console.log('[getSocketURL] API token login detected - using classic WebSocket URL');
            return legacyWsUrl;
        }

        if (accountsList_raw) {
            try {
                const active_loginid = localStorage.getItem('active_loginid');
                if (active_loginid) {
                    const legacyWsUrl = getLegacyServerURL();
                    console.log('[getSocketURL] Legacy user detected with token - using classic WebSocket URL');
                    return legacyWsUrl;
                }
            } catch (e) {
                console.error('[getSocketURL] Error parsing legacy accountsList:', e);
            }
        }

        // No authentication found
        console.log('[getSocketURL] No authentication found - returning default server URL');
        return getDefaultServerURL();
    } catch (error) {
        console.error('[getSocketURL] Error:', error);
        return getDefaultServerURL();
    }
}

/**
 * Generates a cryptographically secure CSRF token
 */
function generateCSRFToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generates a PKCE code verifier
 */
function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generates PKCE code challenge
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const base64 = btoa(String.fromCharCode(...hashArray));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Stores PKCE code verifier in sessionStorage
 */
function storeCodeVerifier(verifier: string): void {
    sessionStorage.setItem('oauth_code_verifier', verifier);
    sessionStorage.setItem('oauth_code_verifier_timestamp', Date.now().toString());
}

/**
 * Retrieves stored PKCE code verifier
 */
export function getCodeVerifier(): string | null {
    const verifier = sessionStorage.getItem('oauth_code_verifier');
    const timestamp = sessionStorage.getItem('oauth_code_verifier_timestamp');

    if (!verifier || !timestamp) {
        return null;
    }

    const verifierAge = Date.now() - parseInt(timestamp, 10);
    if (verifierAge > 600000) {
        sessionStorage.removeItem('oauth_code_verifier');
        sessionStorage.removeItem('oauth_code_verifier_timestamp');
        return null;
    }

    return verifier;
}

/**
 * Clears PKCE code verifier
 */
export function clearCodeVerifier(): void {
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_code_verifier_timestamp');
}

/**
 * Stores CSRF token
 */
function storeCSRFToken(token: string): void {
    sessionStorage.setItem('oauth_csrf_token', token);
    sessionStorage.setItem('oauth_csrf_token_timestamp', Date.now().toString());
}

/**
 * Validates CSRF token
 */
export function validateCSRFToken(token: string): boolean {
    const storedToken = sessionStorage.getItem('oauth_csrf_token');
    const timestamp = sessionStorage.getItem('oauth_csrf_token_timestamp');

    if (!storedToken || !timestamp) {
        return false;
    }

    if (storedToken !== token) {
        return false;
    }

    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > 600000) {
        sessionStorage.removeItem('oauth_csrf_token');
        sessionStorage.removeItem('oauth_csrf_token_timestamp');
        return false;
    }

    return true;
}

/**
 * Clears CSRF token
 */
export function clearCSRFToken(): void {
    sessionStorage.removeItem('oauth_csrf_token');
    sessionStorage.removeItem('oauth_csrf_token_timestamp');
}

export function getAppId(): string {
    return getDomainConfig().appId;
}

export function getDefaultAppIdAndUrl(): { server_url: string; app_id: string } {
    const { appId } = getDomainConfig();
    const isProd = isProduction();
    const serverUrl = `${brandConfig.platform.derivws.url[isProd ? 'production' : 'staging']}options/ws/public`;
    return { server_url: serverUrl, app_id: appId };
}

export function getAuthRedirectUri(): string {
    return getDomainConfig().redirectUri;
}

export async function generateOAuthURL(prompt?: string, domainConfig = getDomainConfig()): Promise<string> {
    try {
        const { clientId, appId, redirectUri, includeLegacyAppIdInOAuth } = domainConfig;

        if (domainConfig.useLegacyOAuthLogin && appId) {
            const params = new URLSearchParams({ app_id: appId });
            if (prompt) {
                params.set('prompt', prompt);
            }
            return `https://oauth.deriv.com/oauth2/authorize?${params.toString()}`;
        }

        // Use brand config for the OAuth2 base URL
        const isProd = isProduction();
        const hostname = brandConfig.platform.auth2_url[isProd ? 'production' : 'staging'];

        if (hostname && clientId) {
            const csrfToken = generateCSRFToken();
            storeCSRFToken(csrfToken);

            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);
            storeCodeVerifier(codeVerifier);

            const params = new URLSearchParams({
                scope: 'trade account_manage',
                response_type: 'code',
                client_id: clientId,
                redirect_uri: redirectUri,
                state: csrfToken,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
            });

            if (prompt) {
                params.set('prompt', prompt);
            }

            if (includeLegacyAppIdInOAuth && appId) {
                params.set('app_id', appId);
            }

            return `${hostname}auth?${params.toString()}`;
        }
    } catch (error) {
        console.error('Error generating OAuth URL:', error);
    }

    return '';
}
