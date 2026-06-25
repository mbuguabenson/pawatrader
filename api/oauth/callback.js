import { URLSearchParams } from 'url';

const normalizeValue = value =>
    typeof value === 'string' ? value.replace(/[\r\n]+/g, '').trim() : value;

function parseCookies(cookieHeader) {
    const list = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(function (cookie) {
        const parts = cookie.split('=');
        const key = parts.shift().trim();
        const value = parts.join('=');
        list[key] = normalizeValue(decodeURIComponent(value));
    });
    return list;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code, state } = req.query || {};
        if (!code || !state) {
            return res.status(400).send('Missing code or state');
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const storedState = cookies.oauth_state;
        const code_verifier = cookies.oauth_code_verifier;
        const client_id_cookie = cookies.oauth_client_id;
        const app_id_cookie = cookies.oauth_app_id;
        const redirect_uri_cookie = cookies.oauth_redirect_uri;

        if (!storedState || !code_verifier) {
            return res.status(400).send('Missing PKCE/session data');
        }

        if (storedState !== state) {
            return res.status(400).send('Invalid state');
        }

        const client_id = normalizeValue(
            client_id_cookie ||
            process.env.DERIV_OAUTH_CLIENT_ID ||
            process.env.OAUTH_CLIENT_ID ||
            process.env.CLIENT_ID
        );
        const app_id = normalizeValue(
            app_id_cookie ||
            process.env.APP_ID ||
            process.env.OAUTH_LEGACY_APP_ID ||
            process.env.DERIV_LEGACY_APP_ID
        );
        const redirect_uri = normalizeValue(
            redirect_uri_cookie ||
            process.env.DERIV_OAUTH_CALLBACK_URI ||
            process.env.OAUTH_CALLBACK_URI ||
            process.env.DERIV_REDIRECT_URI ||
            process.env.OAUTH_REDIRECT_URI ||
            process.env.REDIRECT_URI
        );
        const deriv_app_id = app_id || client_id;

        if ((!client_id && !app_id) || !redirect_uri) {
            return res.status(500).send('Server not configured for OAuth');
        }

        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri,
            code_verifier,
        });

        const useClientId = Boolean(client_id);
        const useAppId = !useClientId && Boolean(app_id);

        if (useClientId) {
            params.set('client_id', client_id);
        } else if (useAppId) {
            params.set('app_id', app_id);
        }

        const tokenResp = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        const tokenData = await tokenResp.json();

        if (!tokenResp.ok) {
            return res.status(500).json({ error: 'token_exchange_failed', details: tokenData });
        }

        const isProd = process.env.NODE_ENV === 'production';
        const cookieOpts = [`HttpOnly`, `Path=/`, isProd ? `SameSite=None` : `SameSite=Lax`];
        if (isProd) cookieOpts.push('Secure');

        const setCookies = [];
        if (tokenData.access_token) {
            const accessMaxAge = Number(tokenData.expires_in) || 3600;
            setCookies.push(
                `deriv_access_token=${encodeURIComponent(tokenData.access_token)}; ${cookieOpts.join('; ')}; Max-Age=${accessMaxAge}`
            );
            setCookies.push(
                `deriv_token_expires=${Date.now() + accessMaxAge * 1000}; ${cookieOpts.join('; ')}; Max-Age=${accessMaxAge}`
            );
        }
        if (tokenData.refresh_token)
            setCookies.push(
                `deriv_refresh_token=${encodeURIComponent(tokenData.refresh_token)}; ${cookieOpts.join('; ')}; Max-Age=604800`
            );

        if (app_id) {
            setCookies.push(`deriv_app_id=${encodeURIComponent(app_id)}; ${cookieOpts.join('; ')}`);
        }

        setCookies.push(`oauth_code_verifier=; Path=/; Max-Age=0; HttpOnly; ${isProd ? 'SameSite=None; Secure' : 'SameSite=Lax'}`);
        setCookies.push(`oauth_state=; Path=/; Max-Age=0; HttpOnly; ${isProd ? 'SameSite=None; Secure' : 'SameSite=Lax'}`);
        setCookies.push(`oauth_preferred_account=; Path=/; Max-Age=0; HttpOnly; ${isProd ? 'SameSite=None; Secure' : 'SameSite=Lax'}`);
        setCookies.push(`oauth_client_id=; Path=/; Max-Age=0; HttpOnly; ${isProd ? 'SameSite=None; Secure' : 'SameSite=Lax'}`);
        setCookies.push(`oauth_app_id=; Path=/; Max-Age=0; HttpOnly; ${isProd ? 'SameSite=None; Secure' : 'SameSite=Lax'}`);
        setCookies.push(`oauth_redirect_uri=; Path=/; Max-Age=0; HttpOnly; ${isProd ? 'SameSite=None; Secure' : 'SameSite=Lax'}`);
        setCookies.push(`logged_state=true; Path=/; ${isProd ? 'SameSite=None; Secure' : 'SameSite=Lax'}`);

        let selectedAccount = null;
        let selectedCurrency = '';
        let selectedType = '';
        let accounts = [];

        if (tokenData.access_token) {
            const accountHeaders = {
                Authorization: `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json',
                ...(deriv_app_id ? { 'Deriv-App-ID': deriv_app_id } : {}),
            };

            const preferredAccount = cookies.oauth_preferred_account;

            // Try to fetch new wallet accounts (DOT, ROT) using trading API
            try {
                const accountResponse = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
                    headers: accountHeaders,
                }).catch(() => null);

                if (accountResponse && accountResponse.ok) {
                    const accountData = await accountResponse.json();
                    const rawAccounts = accountData.accounts || accountData.trading_accounts || [];
                    accounts = rawAccounts
                        .map(account => ({
                            loginid: account.account_id || account.loginid || account.login_id || '',
                            currency: account.currency || '',
                            account_type: account.account_type || (account.is_virtual ? 'demo' : 'real'),
                            is_virtual: account.is_virtual ?? false,
                            balance: account.balance ?? null,
                        }))
                        .filter(account => account.loginid);
                }
            } catch (err) {
                // Continue even if account fetch fails - frontend will discover via api_base.init()
            }

            // Select account based on preference or defaults
            if (accounts.length > 0) {
                const findByPreferred = () => {
                    if (!preferredAccount) return null;
                    const normalized = preferredAccount.toUpperCase();
                    if (normalized === 'DEMO') {
                        return accounts.find(account => account.account_type === 'demo');
                    }
                    return accounts.find(account => account.currency?.toUpperCase() === normalized);
                };

                selectedAccount =
                    findByPreferred() ||
                    accounts.find(account => account.account_type === 'real') ||
                    accounts[0] ||
                    null;
            }
        }

        if (selectedAccount) {
            selectedCurrency = selectedAccount.currency;
            selectedType = selectedAccount.account_type;
            setCookies.push(
                `deriv_selected_loginid=${encodeURIComponent(selectedAccount.loginid)}; ${cookieOpts.join('; ')}`
            );
            if (selectedAccount.account_type) {
                setCookies.push(
                    `deriv_account_type=${encodeURIComponent(selectedAccount.account_type)}; ${cookieOpts.join('; ')}`
                );
            }
            if (selectedAccount.currency) {
                setCookies.push(
                    `deriv_account_currency=${encodeURIComponent(selectedAccount.currency)}; ${cookieOpts.join('; ')}`
                );
            }
        }

        res.setHeader('Set-Cookie', setCookies);

        const wantsJson = req.query.return_json === 'true' || req.headers.accept?.includes('application/json');
        const payload = {
            logged_in: true,
            account_id: selectedAccount?.loginid || null,
            account_type: selectedAccount?.account_type || null,
            currency: selectedCurrency || null,
            app_id: app_id || null,
            client_id: client_id || null,
            accounts,
        };

        if (wantsJson) {
            return res.status(200).json(payload);
        }

        const redirectUrl = new URL('/', `https://${req.headers.host}`);
        if (selectedCurrency) {
            redirectUrl.searchParams.set('account', selectedCurrency);
        }

        return res.writeHead(302, { Location: redirectUrl.toString() }).end();
    } catch (err) {
        return res.status(500).json({
            error: 'oauth_callback_error',
            error_description: err instanceof Error ? err.message : String(err),
        });
    }
}
