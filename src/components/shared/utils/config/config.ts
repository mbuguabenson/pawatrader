import { getPendingApiToken } from '@/utils/api-token-permissions';
import brandConfig from '@/../brand.config.json';

// =============================================================================
// Domain Configuration Map
// Maps each hostname to its specific Deriv APP_ID, OAuth CLIENT_ID, and the
// exact redirect URI registered in that OAuth app.
// =============================================================================

interface DomainConfig {
    clientId: string; // OAuth PKCE CLIENT_ID registered with Deriv
    appId: string; // Deriv APP_ID (used for WebSocket & legacy app_id param)
    redirectUri: string; // MUST exactly match the redirect URI registered in the OAuth app
    botsFolder: string; // Public folder used by Best Bots XML loading for this domain
    includeLegacyAppIdInOAuth: boolean; // Append app_id to the PKCE auth URL (for Deriv routing)
}

const DEFAULT_BOTS_FOLDER = 'profithub';
const DEFAULT_DOMAIN_CONFIG: DomainConfig = {
    clientId: process.env.CLIENT_ID || '33EmTMY5M3NMHve0SU8tY',
    appId: process.env.APP_ID || '80058',
    // /callback is the URI registered in the Deriv OAuth app dashboard.
    // Vercel rewrites /callback → /api/oauth/callback (see vercel.json).
    // Never use /api/oauth/callback here — Deriv will reject it as unregistered.
    redirectUri:
        process.env.REDIRECT_URI ||
        process.env.DERIV_REDIRECT_URI ||
        process.env.OAUTH_REDIRECT_URI ||
        `${window.location.origin}/callback`,
    botsFolder: process.env.BOTS_FOLDER || DEFAULT_BOTS_FOLDER,
    includeLegacyAppIdInOAuth: true,
};

export const DOMAIN_CONFIG: Record<string, DomainConfig> = {
    // redirect_uri MUST match exactly what is registered in the Deriv OAuth app.
    // Vercel rewrites /callback → /api/oauth/callback via vercel.json.
    'brixxie-theta.vercel.app': {
        clientId: '33EmTMY5M3NMHve0SU8tY',
        appId: '80058',
        redirectUri: 'https://brixxie-theta.vercel.app/callback',
        botsFolder: 'profithub',
        includeLegacyAppIdInOAuth: true,
    },
    // Production domain: www.profithub.co.ke
    // Uses dedicated ProfitHub Deriv OAuth app (separate from Brixxie)
    'www.profithub.co.ke': {
        clientId: '33gamhJ1FCjBelYzHVs', // ProfitHub CLIENT_ID from Deriv app
        appId: '33gamhJ1FCjBelYzHVs', // ProfitHub APP_ID from Deriv app
        redirectUri: 'https://www.profithub.co.ke/callback',
        botsFolder: 'profithub',
        includeLegacyAppIdInOAuth: true,
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
    const { appId } = getDomainConfig();
    // Use the standard public Deriv WebSocket endpoint as fallback.
    // The brandConfig.derivws.url is the REST API base and cannot be used directly as a WS URL.
    return `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`;
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

/**
 * Options for generating an OAuth URL.
 * Supports both login and sign-up flows, with optional partner attribution.
 */
export interface OAuthURLOptions {
    /** Pass 'registration' to show the sign-up form instead of login */
    prompt?: string;
    /**
     * Affiliate tracking token. Use the one that matches your referral link:
     * t | affiliate_token | sidi | ca  — they are equivalent aliases.
     * Only include one.
     */
    affiliateToken?: string;
    /** Identifies the marketing campaign (e.g. 'dynamicworks') */
    utmCampaign?: string;
    /** Indicates a partner integration — typically 'affiliate' */
    utmMedium?: string;
    /** Your affiliate ID for commission tracking (e.g. 'CU303219') */
    utmSource?: string;
}

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
            const csrfToken = generateCSRFToken();
            storeCSRFToken(csrfToken);

            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);
            storeCodeVerifier(codeVerifier);

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
            // Use exactly one of: t | affiliate_token | sidi | ca
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

    return '';
}
