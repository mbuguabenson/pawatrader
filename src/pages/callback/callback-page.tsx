import { useEffect, useMemo, useState } from 'react';
import { clearCSRFToken, validateCSRFToken } from '@/components/shared/utils/config/config';
import { Button } from '@deriv-com/ui';

/**
 * Handles the PKCE OAuth2 callback from Deriv.
 *
 * Registered redirect URI: https://brixxie-theta.vercel.app/api/oauth/callback
 * The router also maps the legacy /callback path here.
 *
 * Flow:
 *  1. Deriv redirects here with ?code=...&state=...
 *  2. We validate the CSRF state (stored in sessionStorage before the redirect).
 *  3. We then forward to /api/oauth/callback — the backend performs the PKCE
 *     token exchange, stores tokens in HttpOnly cookies, and redirects to /.
 *
 * Security: The token exchange MUST NOT happen in the browser. Forwarding to
 * the backend endpoint ensures code_verifier and the resulting access_token
 * never travel through client-side JavaScript.
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

            // Validate CSRF state — must match what was stored before the redirect.
            // When the frontend-initiated PKCE flow (generateOAuthURL) is used, the
            // state is the sessionStorage CSRF token and can be validated here.
            // When the backend-initiated flow (/api/oauth/start) is used, the state
            // is a signed PKCE token — validateCSRFToken returns false (expected),
            // and the backend will validate its own signature.
            const isClientSideCsrfValid = validateCSRFToken(state);
            if (isClientSideCsrfValid) {
                // Clear the CSRF token now that it has been validated client-side.
                clearCSRFToken();
            }

            // Hand off to the backend for server-side token exchange.
            // The backend will:
            //  1. Verify the signed PKCE state token (or cookie-based state)
            //  2. Exchange the code + code_verifier for an access_token
            //  3. Set HttpOnly cookies (deriv_access_token, deriv_refresh_token, etc.)
            //  4. Redirect to /
            const backendCallbackUrl = new URL('/api/oauth/callback', window.location.origin);
            backendCallbackUrl.searchParams.set('code', code);
            backendCallbackUrl.searchParams.set('state', state);

            setStatus('success');
            window.location.replace(backendCallbackUrl.toString());
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
