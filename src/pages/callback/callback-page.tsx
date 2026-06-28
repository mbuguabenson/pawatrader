import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import { clearCSRFToken, validateCSRFToken } from '@/components/shared/utils/config/config';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import { Button } from '@deriv-com/ui';

/**
 * Handles the PKCE OAuth2 callback from Deriv.
 *
 * Registered redirect URI: https://brixxie-theta.vercel.app/api/oauth/callback
 * The router also maps the legacy /callback path here.
 *
 * Flow:
 *  1. Deriv redirects here with ?code=...&state=...
 *  2. We validate the CSRF state, exchange code for access token (PKCE),
 *     store auth_info in sessionStorage, set logged_state cookie, then
 *     redirect to the app root.
 */
const CallbackPage = () => {
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);

    useEffect(() => {
        const run = async () => {
            const code = urlParams.get('code');
            const state = urlParams.get('state');
            const error = urlParams.get('error');
            const error_description = urlParams.get('error_description');

            // OAuth server returned an error
            if (error) {
                setStatus('error');
                setErrorMessage(`${error}: ${error_description ?? ''}`);
                return;
            }

            // Must have both code and state for PKCE exchange
            if (!code || !state) {
                setStatus('error');
                setErrorMessage('Missing OAuth callback parameters (code or state).');
                return;
            }

            // Validate CSRF state
            if (!validateCSRFToken(state)) {
                setStatus('error');
                setErrorMessage('Invalid state parameter — possible CSRF attack. Please try logging in again.');
                return;
            }
            clearCSRFToken();

            // Exchange authorization code for access token (PKCE)
            const result = await OAuthTokenExchangeService.exchangeCodeForToken(code);

            if (result.error || !result.access_token) {
                setStatus('error');
                setErrorMessage(result.error_description || result.error || 'Token exchange failed.');
                return;
            }

            // Mark as logged in
            Cookies.set('logged_state', 'true', {
                domain: window.location.hostname,
                expires: 30,
                path: '/',
                secure: window.location.protocol === 'https:',
            });

            setStatus('success');

            // Redirect to app root after short delay for UX
            setTimeout(() => {
                window.location.replace('/');
            }, 500);
        };

        run();
    }, [urlParams]);

    if (status === 'processing') {
        return (
            <div className='callback-page'>
                <p>{'Completing sign in...'}</p>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className='callback-page'>
                <p>{'Sign in successful! Redirecting...'}</p>
            </div>
        );
    }

    // Error state
    return (
        <div className='callback-page'>
            <p>{'Authentication failed.'}</p>
            <p>{errorMessage}</p>
            <Button onClick={() => window.location.replace('/')}>{'Return to Home'}</Button>
        </div>
    );
};

export default CallbackPage;
