import React from 'react';
import Cookies from 'js-cookie';
import ChunkLoader from '@/components/loader/chunk-loader';
// Reference login/auth persistence flow adapted from https://github.com/DukeNyamasege/new-user-interface.git
import { api_base } from '@/external/bot-skeleton';
import { observer as globalObserver } from '@/external/bot-skeleton/utils/observer';
import { clearAuthData } from '@/utils/auth-utils';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { localize } from '@deriv-com/translations';
import { URLUtils } from '@deriv-com/utils';
import App from './App';

// Extend Window interface to include is_tmb_enabled property
declare global {
    interface Window {
        is_tmb_enabled?: boolean;
    }
}

const restoreLoginFromLocalStorage = async () => {
    try {
        const authToken = localStorage.getItem('authToken');
        const activeLoginId = localStorage.getItem('active_loginid');
        
        if (!authToken || !activeLoginId) {
            return false;
        }

        // Restore auth_info from sessionStorage
        try {
            const authInfo = OAuthTokenExchangeService.getAuthInfo();
            if (authInfo?.access_token) {
                // Already has valid auth info
            } else {
                OAuthTokenExchangeService.setAuthInfo({
                    access_token: authToken,
                    token_type: 'bearer',
                    expires_in: 3600,
                    expires_at: Date.now() + 3600 * 1000,
                });
            }
        } catch (e) {
            console.warn('Failed to restore auth_info', e);
        }

        // Now initialize API with active_loginid already set
        await api_base.init(true);

        const authorize = api_base.account_info as any;
        if (authorize?.country) {
            localStorage.setItem('client.country', authorize.country);
        }

        Cookies.set('logged_state', 'true', {
            domain: window.location.hostname,
            expires: 30,
            path: '/',
            secure: window.location.protocol === 'https:',
        });

        return true;
    } catch (error) {
        console.error('Restoring login from localStorage failed:', error);
        clearAuthData();
        return false;
    }
};

const setLocalStorageToken = async (
    loginInfo: URLUtils.LoginInfo[],
    paramsToDelete: string[],
    setIsAuthComplete: React.Dispatch<React.SetStateAction<boolean>>
) => {
    if (loginInfo.length) {
        try {
            const defaultActiveAccount = URLUtils.getDefaultActiveAccount(loginInfo);
            if (!defaultActiveAccount) return;

            const accountsList: Record<string, string> = {};
            const clientAccounts: Record<string, { loginid: string; token: string; currency: string; account_type?: string; balance?: string }> = {};

            loginInfo.forEach((account: { loginid: string; token: string; currency: string; account_type?: string; balance?: string }) => {
                accountsList[account.loginid] = account.token;
                clientAccounts[account.loginid] = {
                    ...account,
                    account_type: account.account_type || (account.loginid?.startsWith('VRTC') || account.loginid?.startsWith('VR') ? 'demo' : 'real'),
                    balance: account.balance ?? '0',
                };
            });

            // CRITICAL: Save all account data first to ensure persistence
            localStorage.setItem('accountsList', JSON.stringify(accountsList));
            localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));

            // Also store accounts in DerivWSAccountsService for centralized handling
            try {
                const deriv_accounts = loginInfo.map((acc: any) => ({
                    account_id: acc.loginid,
                    balance: acc.balance || '0',
                    currency: acc.currency || '',
                    group: acc.group || '',
                    status: acc.status || '',
                    account_type: acc.account_type || (acc.is_virtual ? 'demo' : 'real'),
                }));
                if (deriv_accounts.length) DerivWSAccountsService.storeAccounts(deriv_accounts as any);
            } catch (e) {
                console.warn('Failed to store deriv accounts via service', e);
            }

            URLUtils.filterSearchParams(paramsToDelete);

            const selectedLoginInfo = defaultActiveAccount as any;
            const selectedToken = selectedLoginInfo.token;
            const selectedLoginId = selectedLoginInfo.loginid;

            localStorage.setItem('authToken', selectedToken);
            localStorage.setItem('active_loginid', selectedLoginId);
            localStorage.setItem(
                'account_type',
                selectedLoginInfo.account_type || (selectedLoginId.startsWith('VRTC') || selectedLoginId.startsWith('VR') ? 'demo' : 'real')
            );

            // Store auth_info centrally for other services
            try {
                OAuthTokenExchangeService.setAuthInfo({
                    access_token: selectedToken,
                    token_type: 'bearer',
                    expires_in: 3600,
                    expires_at: Date.now() + 3600 * 1000,
                });
            } catch (e) {
                console.warn('Failed to set auth_info via OAuthTokenExchangeService', e);
            }

            await api_base.init(true);

            if (!api_base.is_authorized) {
                const error = { code: 'InvalidToken' } as any;
                // Set isAuthComplete to true to prevent the app from getting stuck in loading state
                setIsAuthComplete(true);

                const is_tmb_enabled = window.is_tmb_enabled === true;
                // Only emit the InvalidToken event if logged_state is true
                if (Cookies.get('logged_state') === 'true' && !is_tmb_enabled) {
                    // Emit an event that can be caught by the application to retrigger OIDC authentication
                    globalObserver.emit('InvalidToken', { error });
                }

                if (Cookies.get('logged_state') === 'false') {
                    // If the user is not logged out, we need to clear the local storage
                    clearAuthData();
                }
            } else {
                const authorize = api_base.account_info as any;
                localStorage.setItem('client.country', authorize?.country || '');

                // CRITICAL: Set logged_state cookie to ensure session persists
                Cookies.set('logged_state', 'true', {
                    domain: window.location.hostname,
                    expires: 30,
                    path: '/',
                    secure: window.location.protocol === 'https:',
                });
                return;
            }

            // Fallback: Set tokens even if API authorization fails
            localStorage.setItem('authToken', selectedToken);
            localStorage.setItem('active_loginid', selectedLoginId);

            // CRITICAL: Set logged_state cookie to ensure session persists
            Cookies.set('logged_state', 'true', {
                domain: window.location.hostname,
                expires: 30,
                path: '/',
                secure: window.location.protocol === 'https:',
            });
        } catch (error) {
            console.error('Error setting up login info:', error);
        }
    }
};

export const AuthWrapper = () => {
    const [isAuthComplete, setIsAuthComplete] = React.useState(false);
    const { loginInfo, paramsToDelete } = URLUtils.getLoginInfoFromURL();

    React.useEffect(() => {
        const initializeAuth = async () => {
            if (!loginInfo.length) {
                const hasAccounts = Boolean(localStorage.getItem('accountsList') || localStorage.getItem('authToken'));
                if (hasAccounts) {
                    await restoreLoginFromLocalStorage();
                }
            }

            await setLocalStorageToken(loginInfo, paramsToDelete, setIsAuthComplete);
            URLUtils.filterSearchParams(['lang']);
            setIsAuthComplete(true);
        };

        initializeAuth();
    }, [loginInfo, paramsToDelete]);

    if (!isAuthComplete) {
        return <ChunkLoader message={localize('Initializing...')} />;
    }

    return <App />;
};
