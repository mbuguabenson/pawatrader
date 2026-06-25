import { clearCodeVerifier, getAuthRedirectUri, getCodeVerifier, isProduction } from '@/components/shared';
import { getConfiguredAppId, getConfiguredClientId } from '@/components/shared/utils/config/config';
import brandConfig from '@/components/shared/brand.config.json';

/**
 * Response from OAuth2 token exchange endpoint
 */
interface TokenExchangeResponse {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
}

interface AuthInfo {
    access_token: string;
    token_type: string;
    expires_in: number;
    expires_at: number; // Timestamp when token expires
    scope?: string;
    refresh_token?: string;
}

export class OAuthTokenExchangeService {
    private static getOAuth2TokenUrl(): string {
        const environment = isProduction() ? 'production' : 'staging';
        const configuredTokenUrl = (brandConfig as any).oauth?.token_url;
        if (typeof configuredTokenUrl === 'string' && configuredTokenUrl.trim()) {
            return configuredTokenUrl;
        }

        const configuredServerBaseUrl = (brandConfig as any).oauth?.server_base_url;
        if (typeof configuredServerBaseUrl === 'string' && configuredServerBaseUrl.trim()) {
            return `${configuredServerBaseUrl.replace(/\/$/, '')}/oauth2/token`;
        }

        return (brandConfig as any).platform?.auth2_url?.[environment] || 'https://auth.deriv.com/oauth2/token';
    }

    static getAuthInfo(): AuthInfo | null {
        try {
            const authInfoStr = sessionStorage.getItem('auth_info');
            if (!authInfoStr) return null;

            const authInfo: AuthInfo = JSON.parse(authInfoStr);
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
     * Store auth info object directly in sessionStorage
     */
    static setAuthInfo(authInfo: AuthInfo): void {
        try {
            sessionStorage.setItem('auth_info', JSON.stringify(authInfo));
        } catch (error) {
            ErrorLogger.error('OAuth', 'Failed to set auth_info', error);
        }
    }

    static clearAuthInfo(): void {
        sessionStorage.removeItem('auth_info');
    }

    static isAuthenticated(): boolean {
        const authInfo = this.getAuthInfo();
        return authInfo !== null && !!authInfo.access_token;
    }

    static getAccessToken(): string | null {
        const authInfo = this.getAuthInfo();
        return authInfo?.access_token || null;
    }

    static async exchangeCodeForToken(code: string): Promise<TokenExchangeResponse> {
        try {
            const tokenEndpoint = this.getOAuth2TokenUrl();

            const codeVerifier = getCodeVerifier();
            if (!codeVerifier) {
                console.error('OAuth: PKCE code verifier not found or expired');
                return {
                    error: 'invalid_request',
                    error_description: 'PKCE code verifier not found or expired. Please restart authentication.',
                };
            }

            const clientId = getConfiguredClientId();
            const appId = getConfiguredAppId();

            if (!clientId && !appId) {
                console.error('OAuth: CLIENT_ID or APP_ID environment variable is not set');
                return {
                    error: 'invalid_client',
                    error_description: 'CLIENT_ID or APP_ID not configured',
                };
            }

            const requestBody: Record<string, string> = {
                code,
                code_verifier: codeVerifier,
                redirect_uri: getAuthRedirectUri(),
            };

            if (clientId) {
                requestBody.client_id = clientId;
            } else if (appId) {
                requestBody.app_id = String(appId);
            }

            const response = await fetch('/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            const data: TokenExchangeResponse = await response.json();

            if (data.error) {
                console.error(`OAuth Token exchange error: ${data.error}`, data.error_description);
                return { error: data.error, error_description: data.error_description };
            }

            if (data.access_token) {
                clearCodeVerifier();

                const authInfo: AuthInfo = {
                    access_token: data.access_token,
                    token_type: data.token_type || 'bearer',
                    expires_in: data.expires_in || 3600,
                    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
                    scope: data.scope,
                };

                if (data.refresh_token) authInfo.refresh_token = data.refresh_token;

                sessionStorage.setItem('auth_info', JSON.stringify(authInfo));

                // After storing token, fetch accounts and initialize WebSocket (api_base)
                try {
                    const { DerivWSAccountsService } = await import('./derivws-accounts.service');
                    const accounts = await DerivWSAccountsService.fetchAccountsList(data.access_token as string);

                    if (accounts && accounts.length > 0) {
                        DerivWSAccountsService.storeAccounts(accounts);

                        const accountsList: Record<string, string> = {};
                        const clientAccounts: Record<
                            string,
                            {
                                loginid: string;
                                token: string;
                                currency: string;
                                account_type?: string;
                                balance?: string;
                            }
                        > = {};

                        accounts.forEach(account => {
                            const loginid = account.account_id || account.loginid;
                            if (!loginid) return;

                            accountsList[loginid] = data.access_token as string;
                            clientAccounts[loginid] = {
                                loginid,
                                token: data.access_token as string,
                                currency: account.currency || '',
                                account_type: account.account_type || (account.is_virtual ? 'demo' : 'real'),
                                balance: account.balance ?? '0',
                            };
                        });

                        localStorage.setItem('accountsList', JSON.stringify(accountsList));
                        localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));

                        const firstAccount = accounts[0];
                        const activeLoginId = firstAccount.account_id || firstAccount.loginid;
                        if (activeLoginId) {
                            localStorage.setItem('active_loginid', activeLoginId);
                            const isDemo = activeLoginId.startsWith('VRT') || activeLoginId.startsWith('VRTC');
                            localStorage.setItem('account_type', isDemo ? 'demo' : 'real');
                        }

                        const { api_base } = await import('@/external/bot-skeleton');
                        await api_base.init(true);
                    } else {
                        console.error('OAuth: No accounts returned after token exchange');
                        this.clearAuthInfo();
                        return { error: 'no_accounts', error_description: 'No accounts available after authentication' };
                    }
                } catch (error) {
                    console.error('OAuth: Error fetching accounts after token exchange', error);
                    this.clearAuthInfo();
                    return { error: 'account_fetch_failed', error_description: error instanceof Error ? error.message : String(error) };
                }
            }

            return data;
        } catch (error: unknown) {
            console.error('OAuth: Token exchange network or parsing error', error);
            return { error: 'network_error', error_description: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    static async refreshAccessToken(refreshToken: string): Promise<TokenExchangeResponse> {
        try {
            const tokenEndpoint = this.getOAuth2TokenUrl();

            const requestBody = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });

            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: requestBody.toString(),
            });

            const data: TokenExchangeResponse = await response.json();

            if (data.error) {
                console.error(`OAuth Token refresh error: ${data.error}`, data.error_description);
                return { error: data.error, error_description: data.error_description };
            }

            if (data.access_token) {
                const authInfo: AuthInfo = {
                    access_token: data.access_token,
                    token_type: data.token_type || 'bearer',
                    expires_in: data.expires_in || 3600,
                    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
                    scope: data.scope,
                };

                if (data.refresh_token) authInfo.refresh_token = data.refresh_token;
                else {
                    const existingAuth = this.getAuthInfo();
                    if (existingAuth?.refresh_token) authInfo.refresh_token = existingAuth.refresh_token;
                }

                sessionStorage.setItem('auth_info', JSON.stringify(authInfo));
            }

            return data;
        } catch (error: unknown) {
            console.error('OAuth: Token refresh error', error);
            return { error: 'network_error', error_description: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}

export default OAuthTokenExchangeService;
