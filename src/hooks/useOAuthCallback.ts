import { useCallback, useEffect, useState } from 'react';
import { clearCSRFToken, validateCSRFToken } from '@/components/shared/utils/config/config';
import { clearAuthData } from '@/utils/auth-utils';

/**
 * A single account entry parsed from legacy Deriv OAuth callback.
 */
export interface LegacyAccount {
    loginid: string;
    token: string;
    currency: string;
}

/**
 * OAuth callback parameters extracted from URL
 */
export interface OAuthCallbackParams {
    code: string | null;
    state: string | null;
    error: string | null;
    error_description: string | null;
}

/**
 * OAuth callback processing result
 */
export interface OAuthCallbackResult {
    isProcessing: boolean;
    isValid: boolean;
    params: OAuthCallbackParams;
    legacyAccounts: LegacyAccount[];
    error: string | null;
    cleanupURL: () => void;
}

function parseLegacyAccounts(urlParams: URLSearchParams): LegacyAccount[] {
    const accounts: LegacyAccount[] = [];
    let i = 1;
    while (urlParams.has(`acct${i}`)) {
        const loginid = urlParams.get(`acct${i}`) || '';
        const token = urlParams.get(`token${i}`) || '';
        const currency = urlParams.get(`cur${i}`) || '';
        if (loginid && token) {
            accounts.push({ loginid, token, currency });
        }
        i++;
    }
    return accounts;
}

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

    const cleanupURL = useCallback(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('scope');
        url.searchParams.delete('error');
        url.searchParams.delete('error_description');
        let i = 1;
        while (url.searchParams.has(`acct${i}`)) {
            url.searchParams.delete(`acct${i}`);
            url.searchParams.delete(`token${i}`);
            url.searchParams.delete(`cur${i}`);
            i++;
        }
        window.history.replaceState({}, '', url.toString());
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);

        // Legacy OAuth check
        const legacyAccounts = parseLegacyAccounts(urlParams);
        if (legacyAccounts.length > 0) {
            setResult({
                isProcessing: false,
                isValid: false,
                params: { code: null, state: null, error: null, error_description: null },
                legacyAccounts,
                error: null,
            });
            return;
        }

        // New OAuth2 PKCE check
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
