import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import { crypto_currencies_display_order, fiat_currencies_display_order } from '@/components/shared';
import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';
import { observer as globalObserver } from '@/external/bot-skeleton/utils/observer';
import useTMB from '@/hooks/useTMB';
import { clearAuthData } from '@/utils/auth-utils';
import { Callback } from '@deriv-com/auth-client';
import { Button } from '@deriv-com/ui';

/**
 * Gets the selected currency or falls back to appropriate defaults
 */
const getSelectedCurrency = (
    tokens: Record<string, string>,
    clientAccounts: Record<string, any>,
    state: any
): string => {
    const getQueryParams = new URLSearchParams(window.location.search);
    const currency =
        (state && state?.account) ||
        getQueryParams.get('account') ||
        sessionStorage.getItem('query_param_currency') ||
        '';
    const firstAccountKey = tokens.acct1;
    const firstAccountCurrency = clientAccounts[firstAccountKey]?.currency;

    const validCurrencies = [...fiat_currencies_display_order, ...crypto_currencies_display_order];
    if (tokens.acct1?.startsWith('VR') || currency.toLowerCase() === 'demo') return 'demo';
    if (currency && validCurrencies.includes(currency.toUpperCase())) return currency;
    return firstAccountCurrency || 'USD';
};

const hasLegacyTokens = (urlParams: URLSearchParams) => {
    return [...urlParams.keys()].some(key => key.startsWith('acct') || key.startsWith('token') || key.startsWith('cur'));
};

const CallbackPage = () => {
    const { is_tmb_enabled = false } = useTMB();
    const [status, setStatus] = useState<'redirecting' | 'processing' | 'ready' | 'error'>('ready');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);

    useEffect(() => {
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const error_description = urlParams.get('error_description');

        if (error) {
            setStatus('error');
            setErrorMessage(`${error}: ${error_description ?? ''}`);
            return;
        }

        if (code && state) {
            setStatus('redirecting');
            window.location.replace(`/api/oauth/callback?${urlParams.toString()}`);
            return;
        }

        if (hasLegacyTokens(urlParams)) {
            setStatus('processing');
            return;
        }

        setStatus('error');
        setErrorMessage('No OAuth callback parameters found.');
    }, [urlParams]);

    if (status === 'processing' && hasLegacyTokens(urlParams)) {
        return (
            <Callback
                onSignInSuccess={async (tokens: Record<string, string>, rawState: unknown) => {
                    const state = rawState as { account?: string } | null;
                    const accountsList: Record<string, string> = {};
                    const clientAccounts: Record<
                        string,
                        { loginid: string; token: string; currency: string; account_type?: string; balance?: string }
                    > = {};

                    for (const [key, value] of Object.entries(tokens)) {
                        if (key.startsWith('acct')) {
                            const tokenKey = key.replace('acct', 'token');
                            if (tokens[tokenKey]) {
                                accountsList[value] = tokens[tokenKey];
                                clientAccounts[value] = {
                                    loginid: value,
                                    token: tokens[tokenKey],
                                    currency: '',
                                    account_type: undefined,
                                    balance: undefined,
                                };
                            }
                        } else if (key.startsWith('cur')) {
                            const accKey = key.replace('cur', 'acct');
                            if (tokens[accKey] && clientAccounts[tokens[accKey]]) {
                                clientAccounts[tokens[accKey]].currency = value;
                            }
                        }
                    }

                    const updateClientAccountsFromAuthorize = (authorize: any) => {
                        if (!authorize?.account_list?.length) return;

                        authorize.account_list.forEach((account: any) => {
                            const loginid = account.loginid;
                            if (!loginid) return;

                            const existing = clientAccounts[loginid] || {
                                loginid,
                                token: tokens.token1,
                                currency: account.currency || '',
                                account_type: account.account_type || (account.is_virtual ? 'demo' : 'real'),
                                balance: account.balance?.toString() || '0',
                            };

                            existing.currency = account.currency || existing.currency;
                            existing.account_type = account.account_type || existing.account_type || (account.is_virtual ? 'demo' : 'real');
                            existing.balance = account.balance?.toString() || existing.balance || '0';
                            existing.token = existing.token || tokens.token1;

                            clientAccounts[loginid] = existing;
                            accountsList[loginid] = existing.token;
                        });
                    };

                    localStorage.setItem('accountsList', JSON.stringify(accountsList));
                    localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));

                    let selectedLoginId = tokens.acct1 || Object.keys(clientAccounts)[0] || '';
                    let selectedAccountType = undefined;

                    let is_token_set = false;
                    const api = await generateDerivApiInstance();
                    if (api) {
                        const { authorize, error } = await api.authorize(tokens.token1);
                        api.disconnect();
                        if (error) {
                            if (error.code === 'InvalidToken') {
                                is_token_set = true;
                                if (Cookies.get('logged_state') === 'true' && !is_tmb_enabled) {
                                    globalObserver.emit('InvalidToken', { error });
                                }
                                if (Cookies.get('logged_state') === 'false') {
                                    clearAuthData();
                                }
                            }
                        } else {
                            localStorage.setItem('callback_token', authorize.toString());
                            updateClientAccountsFromAuthorize(authorize);

                            const firstId = authorize?.account_list?.[0]?.loginid;
                            const filteredTokens = Object.values(clientAccounts).filter(account => account.loginid === firstId);
                            if (filteredTokens.length) {
                                const selectedAccount = filteredTokens[0];
                                localStorage.setItem('authToken', selectedAccount.token);
                                localStorage.setItem('active_loginid', selectedAccount.loginid);
                                selectedLoginId = selectedAccount.loginid;
                                selectedAccountType = selectedAccount.account_type;
                                is_token_set = true;
                            }
                        }
                    }

                    const finalAccount = clientAccounts[selectedLoginId] || Object.values(clientAccounts)[0];
                    if (finalAccount) {
                        selectedLoginId = finalAccount.loginid;
                        selectedAccountType = selectedAccountType || finalAccount.account_type;
                        localStorage.setItem('authToken', finalAccount.token);
                        localStorage.setItem('active_loginid', finalAccount.loginid);
                        if (finalAccount.account_type) {
                            localStorage.setItem('account_type', finalAccount.account_type);
                        }
                        localStorage.setItem('client.country', finalAccount.currency || '');
                    }

                    if (!is_token_set && finalAccount) {
                        localStorage.setItem('authToken', finalAccount.token);
                        localStorage.setItem('active_loginid', finalAccount.loginid);
                    }

                    Cookies.set('logged_state', 'true', {
                        domain: window.location.hostname,
                        expires: 30,
                        path: '/',
                        secure: window.location.protocol === 'https:',
                    });

                    const selected_currency = getSelectedCurrency(tokens, clientAccounts, state);

                    await new Promise(resolve => setTimeout(resolve, 100));
                    window.location.replace(window.location.origin + `/?account=${selected_currency}`);
                }}
                renderReturnButton={() => {
                    return (
                        <Button
                            className='callback-return-button'
                            onClick={() => {
                                window.location.href = '/';
                            }}
                        >
                            {'Return to Bot'}
                        </Button>
                    );
                }}
            />
        );
    }

    return (
        <div className='callback-page'>
            {status === 'redirecting' && <p>{'Completing sign in ...'}</p>}
            {status === 'ready' && <p>{'Preparing callback...'}</p>}
            {status === 'error' && (
                <>
                    <p>{'Authentication failed.'}</p>
                    <p>{errorMessage}</p>
                    <Button onClick={() => window.location.replace('/')}>{'Return to Home'}</Button>
                </>
            )}
        </div>
    );
};

export default CallbackPage;
