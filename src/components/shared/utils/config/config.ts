import { isStaging } from '../url/helpers';
import brandConfig from '../../brand.config.json';

export const APP_IDS = {
    LOCALHOST: 36300,
    TMP_STAGING: 64584,
    STAGING: 29934,
    STAGING_BE: 29934,
    STAGING_ME: 29934,
    PRODUCTION: 117164,
    PRODUCTION_BE: 117164,
    PRODUCTION_ME: 117164,
};

export const livechat_license_id = 12049137;
export const livechat_client_id = '66aa088aad5a414484c1fd1fa8a5ace7';

export const domain_app_ids = {
    'dbot12.netlify.app': 80491,
    'kingstraders.site': 85821,
    'www.kingstraders.site': 85821,
    'wallacetraders.site': 86003,
    'www.wallacetraders.site': 86003,
    'legoo.site': 85150,
    'www.legoo.site': 85150,
    'dbotprinters.site': 86059,
    'www.dbotprinters.site': 86059,
    'www.kenyanhennessy.site': 97088,
    'kenyanhennessy.site': 97088,
    'masterhunter.site': 96223,
    'developmentviewport.netlify.app': 97311,
    'www.developmentviewport.netlify.app': 97311,
    'qtropwinninghub.vercel.app': 107823,
    'www.qtropwinninghub.vercel.app': 107823,
    'qtropwinnershub.site': 107823,
    'www.qtropwinnershub.site': 107823,
};

export const getCurrentProductionDomain = () => {
    // If it's staging, return null to use staging app ID
    if (/^staging\./.test(window.location.hostname)) {
        return null;
    }

    // Check if domain is explicitly configured
    const exactMatch = Object.keys(domain_app_ids).find(domain => window.location.hostname === domain);
    if (exactMatch) {
        return exactMatch;
    }

    // For any other production domain, return the hostname to use production app ID
    return window.location.hostname;
};

export const getConfiguredAppId = () => {
    const configured_app_id =
        process.env.APP_ID ||
        process.env.OAUTH_LEGACY_APP_ID ||
        process.env.LEGACY_APP_ID ||
        process.env.REACT_APP_APP_ID ||
        process.env.REACT_APP_LEGACY_APP_ID ||
        process.env.VITE_APP_ID ||
        process.env.VITE_LEGACY_APP_ID ||
        localStorage.getItem('configured_app_id') ||
        (brandConfig.oauth?.app_id ? String(brandConfig.oauth.app_id) : '');

    if (!configured_app_id) {
        return null;
    }

    const parsed_app_id = Number(configured_app_id);

    if (!Number.isNaN(parsed_app_id)) {
        return parsed_app_id;
    }

    return null;
};

export const getConfiguredClientId = () =>
    process.env.CLIENT_ID ||
    process.env.DERIV_OAUTH_CLIENT_ID ||
    process.env.OAUTH_CLIENT_ID ||
    process.env.REACT_APP_CLIENT_ID ||
    process.env.REACT_APP_OAUTH_CLIENT_ID ||
    process.env.VITE_CLIENT_ID ||
    process.env.VITE_OAUTH_CLIENT_ID ||
    localStorage.getItem('configured_client_id') ||
    brandConfig.oauth?.client_id ||
    ''; 

const getOAuthBaseUrl = () =>
    process.env.AUTH_BASE_URL ||
    process.env.OAUTH_BASE_URL ||
    process.env.REACT_APP_AUTH_BASE_URL ||
    process.env.REACT_APP_OAUTH_BASE_URL ||
    process.env.VITE_AUTH_BASE_URL ||
    process.env.VITE_OAUTH_BASE_URL ||
    brandConfig.oauth?.server_base_url ||
    'https://auth.deriv.com';

const getOAuthAuthorizationPath = () =>
    process.env.AUTHORIZATION_PATH ||
    process.env.OAUTH_AUTHORIZATION_PATH ||
    process.env.REACT_APP_AUTHORIZATION_PATH ||
    process.env.REACT_APP_OAUTH_AUTHORIZATION_PATH ||
    process.env.VITE_AUTHORIZATION_PATH ||
    process.env.VITE_OAUTH_AUTHORIZATION_PATH ||
    brandConfig.oauth?.authorization_path ||
    '/oauth2/auth';

const getOAuthScope = () =>
    process.env.SCOPE ||
    process.env.OAUTH_SCOPE ||
    process.env.REACT_APP_SCOPE ||
    process.env.REACT_APP_OAUTH_SCOPE ||
    process.env.VITE_SCOPE ||
    process.env.VITE_OAUTH_SCOPE ||
    brandConfig.oauth?.scope ||
    'trade+account_manage';

const OAUTH_STATE_KEY = 'oauth_csrf_token';
const OAUTH_STATE_TIMESTAMP_KEY = 'oauth_csrf_token_timestamp';
const OAUTH_CODE_VERIFIER_KEY = 'oauth_code_verifier';
const OAUTH_CODE_VERIFIER_TIMESTAMP_KEY = 'oauth_code_verifier_timestamp';
const OAUTH_TOKEN_EXPIRY_MS = 600000;

const getCrypto = () => globalThis.crypto || window.crypto;

const createRandomString = (length = 64) => {
    const random_bytes = new Uint8Array(length);
    getCrypto().getRandomValues(random_bytes);

    return Array.from(random_bytes, byte => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, length);
};

const encodeUtf8 = (value: string) => {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(value);
    }

    const encoded = unescape(encodeURIComponent(value));
    const bytes = new Uint8Array(encoded.length);

    for (let index = 0; index < encoded.length; index += 1) {
        bytes[index] = encoded.charCodeAt(index);
    }

    return bytes;
};

const createCodeChallenge = async (code_verifier: string) => {
    const data = encodeUtf8(code_verifier);
    const crypto_api = getCrypto();

    if (typeof crypto_api?.subtle?.digest !== 'function') {
        throw new Error('Unable to create an OAuth code challenge');
    }

    const digest = await crypto_api.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    let binary = '';

    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const getOAuthState = () => sessionStorage.getItem(OAUTH_STATE_KEY);

export const getCodeVerifier = () => {
    const code_verifier = sessionStorage.getItem(OAUTH_CODE_VERIFIER_KEY);
    const timestamp = sessionStorage.getItem(OAUTH_CODE_VERIFIER_TIMESTAMP_KEY);

    if (!code_verifier || !timestamp) {
        return null;
    }

    const timestamp_value = Number(timestamp);
    if (!Number.isFinite(timestamp_value)) {
        clearCodeVerifier();
        return null;
    }

    if (Date.now() - timestamp_value > OAUTH_TOKEN_EXPIRY_MS) {
        clearCodeVerifier();
        return null;
    }

    return code_verifier;
};

export const clearCodeVerifier = () => {
    sessionStorage.removeItem(OAUTH_CODE_VERIFIER_KEY);
    sessionStorage.removeItem(OAUTH_CODE_VERIFIER_TIMESTAMP_KEY);
};

export const clearOAuthSession = () => {
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_TIMESTAMP_KEY);
    clearCodeVerifier();
};

export const validateCSRFToken = (token: string): boolean => {
    const stored_token = sessionStorage.getItem(OAUTH_STATE_KEY);
    const timestamp = sessionStorage.getItem(OAUTH_STATE_TIMESTAMP_KEY);

    if (!stored_token || !timestamp) {
        return false;
    }

    if (stored_token !== token) {
        return false;
    }

    const timestamp_value = Number(timestamp);
    if (!Number.isFinite(timestamp_value)) {
        clearOAuthSession();
        return false;
    }

    if (Date.now() - timestamp_value > OAUTH_TOKEN_EXPIRY_MS) {
        clearOAuthSession();
        return false;
    }

    return true;
};

export const clearCSRFToken = () => {
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_TIMESTAMP_KEY);
};

export const getAuthRedirectUri = () => {
    const configuredRedirectUri =
        process.env.DERIV_REDIRECT_URI ||
        process.env.DERIV_OAUTH_REDIRECT_URI ||
        process.env.REDIRECT_URI ||
        process.env.OAUTH_REDIRECT_URI ||
        process.env.REACT_APP_REDIRECT_URI ||
        process.env.REACT_APP_OAUTH_REDIRECT_URI ||
        process.env.VITE_REDIRECT_URI ||
        process.env.VITE_OAUTH_REDIRECT_URI ||
        (brandConfig.oauth?.redirect_uri ? String(brandConfig.oauth.redirect_uri) : '');

    if (configuredRedirectUri) {
        return configuredRedirectUri;
    }

    const protocol = window.location.protocol;
    const host = window.location.host;
    const isProd = isProduction();

    if (isProd) {
        return `https://${brandConfig.brand_domain}/`;
    }

    return `${protocol}//${host}/`;
};

export const getOAuthCallbackUri = () => {
    const configuredCallbackUri =
        process.env.DERIV_OAUTH_CALLBACK_URI ||
        process.env.OAUTH_CALLBACK_URI ||
        process.env.DERIV_REDIRECT_URI ||
        process.env.OAUTH_REDIRECT_URI ||
        process.env.REACT_APP_OAUTH_CALLBACK_URI ||
        process.env.REACT_APP_OAUTH_REDIRECT_URI ||
        process.env.VITE_OAUTH_CALLBACK_URI ||
        process.env.VITE_OAUTH_REDIRECT_URI ||
        (brandConfig.oauth?.callback_uri ? String(brandConfig.oauth.callback_uri) : '');

    if (configuredCallbackUri) {
        return configuredCallbackUri;
    }

    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}/callback`;
};

export const isProduction = () => {
    const all_domains = Object.keys(domain_app_ids).map(domain => `(www\\.)?${domain.replace('.', '\\.')}`);
    return new RegExp(`^(${all_domains.join('|')})$`, 'i').test(window.location.hostname);
};

export const isTestLink = () => {
    return (
        window.location.origin?.includes('.binary.sx') ||
        window.location.origin?.includes('bot-65f.pages.dev') ||
        isLocal()
    );
};

export const isLocal = () => /localhost(:\d+)?$/i.test(window.location.hostname);

const getDefaultServerURL = () => {
    const server = 'ws';
    const server_url = `${server}.derivws.com`;

    return server_url;
};

export const getDefaultAppIdAndUrl = () => {
    const server_url = getDefaultServerURL();

    if (isTestLink()) {
        return { app_id: APP_IDS.LOCALHOST, server_url };
    }

    const current_domain = getCurrentProductionDomain() ?? '';
    const app_id = domain_app_ids[current_domain as keyof typeof domain_app_ids] ?? APP_IDS.PRODUCTION;

    return { app_id, server_url };
};

// Default app ID - always 117164
const DEFAULT_APP_ID = 117164;

/**
 * No-op function for backward compatibility - app ID no longer switches
 */
export const switchAppIdAfterTrade = () => {
    // App ID switching is disabled - always use 117164
    return null;
};

// Force update app ID in localStorage on app initialization
export const forceUpdateAppId = () => {
    const app_id = getAppId();

    window.localStorage.setItem('config.app_id', app_id.toString());

    return app_id;
};

export const getAppId = () => {
    const configured_app_id = getConfiguredAppId();

    if (configured_app_id) {
        window.localStorage.setItem('configured_app_id', configured_app_id.toString());
        window.localStorage.setItem('config.app_id', configured_app_id.toString());

        return configured_app_id;
    }

    let app_id = null;

    if (isStaging()) {
        app_id = APP_IDS.STAGING;
    } else if (isTestLink()) {
        app_id = APP_IDS.LOCALHOST;
    } else {
        const current_domain = getCurrentProductionDomain();

        // If domain is explicitly configured, use that app ID
        if (current_domain && domain_app_ids[current_domain as keyof typeof domain_app_ids]) {
            app_id = domain_app_ids[current_domain as keyof typeof domain_app_ids];
        } else {
            // For production domains, always use default app ID 117164
            app_id = DEFAULT_APP_ID;
        }
    }

    // Always force update localStorage with the current app ID
    // This ensures the browser always uses the current app_id
    window.localStorage.setItem('config.app_id', app_id.toString());

    return app_id;
};

export const getSocketURL = () => {
    const local_storage_server_url = window.localStorage.getItem('config.server_url');
    if (local_storage_server_url) return local_storage_server_url;

    const server_url = getDefaultServerURL();

    return server_url;
};

export const checkAndSetEndpointFromUrl = () => {
    if (isTestLink()) {
        const url_params = new URLSearchParams(location.search.slice(1));

        if (url_params.has('qa_server') && url_params.has('app_id')) {
            const qa_server = url_params.get('qa_server') || '';
            const app_id = url_params.get('app_id') || '';

            url_params.delete('qa_server');
            url_params.delete('app_id');

            if (/^(^(www\.)?qa[0-9]{1,4}\.deriv.dev|(.*)\.derivws\.com)$/.test(qa_server) && /^[0-9]+$/.test(app_id)) {
                localStorage.setItem('config.app_id', app_id);
                localStorage.setItem('config.server_url', qa_server.replace(/"/g, ''));
            }

            const params = url_params.toString();
            const hash = location.hash;

            location.href = `${location.protocol}//${location.hostname}${location.pathname}${
                params ? `?${params}` : ''
            }${hash || ''}`;

            return true;
        }
    }

    return false;
};

export const getDebugServiceWorker = () => {
    const debug_service_worker_flag = window.localStorage.getItem('debug_service_worker');
    if (debug_service_worker_flag) return !!parseInt(debug_service_worker_flag);

    return false;
};

export const generateOAuthURL = async (prompt?: string) => {
    const configured_client_id = getConfiguredClientId();
    const configured_app_id = getConfiguredAppId();
    const preferred_account =
        new URLSearchParams(window.location.search).get('account') ||
        sessionStorage.getItem('query_param_currency') ||
        '';

    if (!configured_client_id && !configured_app_id) {
        throw new Error('CLIENT_ID or APP_ID is required for OAuth login');
    }

    const oauthStartUrl = new URL('/api/oauth/start', window.location.origin);

    if (configured_client_id) {
        oauthStartUrl.searchParams.set('client_id', configured_client_id);
    }
    if (configured_app_id) {
        oauthStartUrl.searchParams.set('app_id', String(configured_app_id));
    }

    oauthStartUrl.searchParams.set('redirect_uri', getOAuthCallbackUri());
    oauthStartUrl.searchParams.set('scope', getOAuthScope());

    if (preferred_account) {
        oauthStartUrl.searchParams.set('account', preferred_account);
    }

    if (prompt) {
        oauthStartUrl.searchParams.set('prompt', prompt);
    }

    return oauthStartUrl.toString();
};
