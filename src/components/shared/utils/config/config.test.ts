import {
    clearCSRFToken,
    clearOAuthSession,
    forceUpdateAppId,
    generateOAuthURL,
    getAppId,
    getAuthRedirectUri,
    getCodeVerifier,
    validateCSRFToken,
} from './config';

describe('auth config helpers', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        delete process.env.APP_ID;
        delete process.env.CLIENT_ID;
        delete process.env.OAUTH_CLIENT_ID;
        delete process.env.OAUTH_REDIRECT_URI;
        delete process.env.OAUTH_CALLBACK_URI;
        delete process.env.OAUTH_LEGACY_APP_ID;
        delete process.env.OAUTH_SCOPE;
        delete process.env.OAUTH_BASE_URL;
        delete process.env.OAUTH_AUTHORIZATION_PATH;
        delete process.env.DERIV_OAUTH_CLIENT_ID;
        delete process.env.DERIV_REDIRECT_URI;
        delete process.env.DERIV_OAUTH_REDIRECT_URI;
        delete process.env.DERIV_OAUTH_CALLBACK_URI;
        delete process.env.REACT_APP_OAUTH_CLIENT_ID;
        delete process.env.REACT_APP_OAUTH_REDIRECT_URI;
        delete process.env.REACT_APP_OAUTH_CALLBACK_URI;
        delete process.env.REACT_APP_OAUTH_SCOPE;
        delete process.env.REACT_APP_OAUTH_BASE_URL;
        delete process.env.REACT_APP_OAUTH_AUTHORIZATION_PATH;
        delete process.env.VITE_OAUTH_CLIENT_ID;
        delete process.env.VITE_OAUTH_REDIRECT_URI;
        delete process.env.VITE_OAUTH_CALLBACK_URI;
        delete process.env.VITE_OAUTH_SCOPE;
        delete process.env.VITE_OAUTH_BASE_URL;
        delete process.env.VITE_OAUTH_AUTHORIZATION_PATH;
        delete process.env.REDIRECT_URI;
        delete process.env.REACT_APP_REDIRECT_URI;
        delete process.env.VITE_REDIRECT_URI;
    });

    it('uses the configured client ID for OAuth and generates a server-side PKCE start URL', async () => {
        process.env.CLIENT_ID = 'client-123';

        const oauthUrl = await generateOAuthURL();
        const parsedUrl = new URL(oauthUrl);

        expect(parsedUrl.origin).toBe(window.location.origin);
        expect(parsedUrl.pathname).toBe('/api/oauth/start');
        expect(parsedUrl.searchParams.get('client_id')).toBe('client-123');
        expect(parsedUrl.searchParams.get('redirect_uri')).toBe(`${window.location.origin}/callback`);
        expect(parsedUrl.searchParams.get('scope')).toBe('trade+account_manage');
        expect(parsedUrl.searchParams.get('prompt')).toBeNull();
        expect(parsedUrl.searchParams.get('state')).toBeNull();
        expect(parsedUrl.searchParams.get('code_challenge')).toBeNull();
        expect(parsedUrl.searchParams.get('app_id')).toBeNull();
        expect(sessionStorage.getItem('oauth_csrf_token')).toBeNull();
        expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
    });

    it('supports OAUTH_CLIENT_ID and OAUTH_CALLBACK_URI env aliases for production Vercel deployment', async () => {
        delete process.env.CLIENT_ID;
        process.env.OAUTH_CLIENT_ID = 'oauth-client-456';
        process.env.OAUTH_CALLBACK_URI = 'https://app.example.com/api/oauth/callback';

        const oauthUrl = await generateOAuthURL();
        const parsedUrl = new URL(oauthUrl);

        expect(parsedUrl.searchParams.get('client_id')).toBe('oauth-client-456');
        expect(parsedUrl.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/oauth/callback');
        expect(parsedUrl.searchParams.get('scope')).toBe('trade+account_manage');
        expect(sessionStorage.getItem('oauth_csrf_token')).toBeNull();
        expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
    });

    it('supports DERIV_OAUTH_CLIENT_ID and DERIV_REDIRECT_URI env aliases', async () => {
        delete process.env.CLIENT_ID;
        process.env.DERIV_OAUTH_CLIENT_ID = 'deriv-client-789';
        process.env.DERIV_REDIRECT_URI = 'https://deriv.example.com/api/oauth/callback';

        const oauthUrl = await generateOAuthURL();
        const parsedUrl = new URL(oauthUrl);

        expect(parsedUrl.searchParams.get('client_id')).toBe('deriv-client-789');
        expect(parsedUrl.searchParams.get('redirect_uri')).toBe('https://deriv.example.com/api/oauth/callback');
        expect(parsedUrl.searchParams.get('scope')).toBe('trade+account_manage');
        expect(sessionStorage.getItem('oauth_csrf_token')).toBeNull();
        expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
    });

    it('returns a DERIV_REDIRECT_URI configured auth callback URL', () => {
        process.env.DERIV_REDIRECT_URI = 'https://deriv.example.com/';
        expect(getAuthRedirectUri()).toBe('https://deriv.example.com/');
    });

    it('persists the configured APP_ID into localStorage', () => {
        process.env.APP_ID = '987654';

        const appId = forceUpdateAppId();

        expect(appId).toBe(987654);
        expect(localStorage.getItem('config.app_id')).toBe('987654');
    });

    it('includes optional app_id when both client_id and app_id are configured', async () => {
        process.env.CLIENT_ID = 'client-123';
        process.env.APP_ID = '246810';

        const oauthUrl = await generateOAuthURL();
        const parsedUrl = new URL(oauthUrl);

        expect(parsedUrl.searchParams.get('client_id')).toBe('client-123');
        expect(parsedUrl.searchParams.get('app_id')).toBe('246810');
    });

    it('returns the current origin as the auth callback URL', () => {
        expect(getAuthRedirectUri()).toBe(`${window.location.origin}/`);
    });

    it('returns the configured app id from getAppId when available', () => {
        process.env.APP_ID = '246810';

        expect(getAppId()).toBe(246810);
    });

    it('uses the server-side PKCE start URL when legacy app_id is configured without CLIENT_ID', async () => {
        process.env.APP_ID = '246810';

        const oauthUrl = await generateOAuthURL();
        const parsedUrl = new URL(oauthUrl);

        expect(parsedUrl.origin).toBe(window.location.origin);
        expect(parsedUrl.pathname).toBe('/api/oauth/start');
        expect(parsedUrl.searchParams.get('client_id')).toBeNull();
        expect(parsedUrl.searchParams.get('app_id')).toBe('246810');
        expect(parsedUrl.searchParams.get('redirect_uri')).toBe(`${window.location.origin}/callback`);
        expect(parsedUrl.searchParams.get('scope')).toBe('trade+account_manage');
    });

    it('does not persist PKCE state in browser session when using server-side OAuth start', async () => {
        process.env.APP_ID = '246810';

        await generateOAuthURL();

        expect(sessionStorage.getItem('oauth_csrf_token')).toBeNull();
        expect(getCodeVerifier()).toBeNull();

        clearOAuthSession();
        expect(sessionStorage.getItem('oauth_csrf_token')).toBeNull();
        expect(getCodeVerifier()).toBeNull();
    });
});
