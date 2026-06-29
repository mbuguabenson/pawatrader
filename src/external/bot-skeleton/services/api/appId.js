import { getSocketURL } from '@/components/shared';
import { assertApiTokenScope, getPendingApiToken, isApiTokenSession } from '@/utils/api-token-permissions';
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';
import APIMiddleware from './api-middleware';

/**
 * Singleton instance management for DerivAPI
 */
let derivApiInstance = null;
let derivApiPromise = null;
let currentWebSocketURL = null;

/**
 * Clears the singleton instance (useful for logout or forced reconnection)
 */
export const clearDerivApiInstance = () => {
    if (derivApiInstance?.connection) {
        try {
            derivApiInstance.connection.close();
        } catch (error) {
            console.error('[DerivAPI] Error closing WebSocket:', error);
        }
    }
    derivApiInstance = null;
    derivApiPromise = null;
    currentWebSocketURL = null;
};

/**
 * Generates a Deriv API instance with WebSocket connection using singleton pattern
 * Prevents multiple WebSocket connections by reusing existing instance
 * Now supports async WebSocket URL fetching with authenticated flow
 * @param {boolean} forceNew - Force creation of new instance (default: false)
 * @returns Promise with DerivAPIBasic instance
 */
export const generateDerivApiInstance = async (forceNew = false) => {
    // If forcing new instance, clear existing one
    if (forceNew) {
        console.log('[DerivAPI] Forcing new instance creation');
        clearDerivApiInstance();
    }

    // If there's already an instance, check its state
    if (derivApiInstance) {
        const readyState = derivApiInstance.connection?.readyState;
        // Return existing instance if it's connecting or open
        if (readyState === WebSocket.CONNECTING || readyState === WebSocket.OPEN) {
            console.log('[DerivAPI] Reusing existing instance (state:', readyState, ')');
            return derivApiInstance;
        } else {
            // Connection is closed or closing, clear it
            console.log('[DerivAPI] Existing instance not usable (state:', readyState, '), creating new');
            clearDerivApiInstance();
        }
    }

    // If there's already a creation in progress, return that promise
    if (derivApiPromise) {
        console.log('[DerivAPI] Reusing existing creation promise');
        return derivApiPromise;
    }

    // Create new instance
    derivApiPromise = (async () => {
        try {
            console.log('[Deriv] Connecting...');
            // Await the async getSocketURL() function
            const wsURL = await getSocketURL();

            // Check if URL changed (account switch scenario)
            if (currentWebSocketURL && currentWebSocketURL !== wsURL) {
                console.log('[DerivAPI] WebSocket URL changed, clearing old instance');
                clearDerivApiInstance();
            }

            currentWebSocketURL = wsURL;

            console.log('[DerivAPI] Creating new WebSocket connection to:', wsURL);
            const deriv_socket = new WebSocket(wsURL);
            const deriv_api = new DerivAPIBasic({
                connection: deriv_socket,
                middleware: new APIMiddleware({}),
            });

            // Wait for the WebSocket to OPEN before returning the instance!
            await new Promise((resolve, reject) => {
                const onOpen = () => {
                    console.log('[Deriv] Connected');
                    resolve();
                };

                const onError = (error) => {
                    console.error('[Deriv] Connection Error:', error);
                    reject(error);
                };

                const onClose = (event) => {
                    console.warn('[Deriv] Connection closed unexpectedly:', event.code, event.reason);
                    reject(new Error(`WebSocket closed: ${event.code} ${event.reason}`));
                };

                deriv_socket.addEventListener('open', onOpen, { once: true });
                deriv_socket.addEventListener('error', onError, { once: true });
                deriv_socket.addEventListener('close', onClose, { once: true });

                // Cleanup listeners in case of timeout or early resolution
                setTimeout(() => {
                    deriv_socket.removeEventListener('open', onOpen);
                    deriv_socket.removeEventListener('error', onError);
                    deriv_socket.removeEventListener('close', onClose);
                }, 30000);
            });

            const rawSend = deriv_api.send.bind(deriv_api);
            deriv_api.send = request => {
                // Add unique req_id if not present
                if (request && typeof request === 'object' && !request.req_id) {
                    request.req_id = Date.now() + Math.random().toString(36).substr(2, 9);
                }
                console.log('[Deriv] Sending request:', JSON.stringify(request, null, 2));

                if (isApiTokenSession() && request && typeof request === 'object') {
                    if ('balance' in request) assertApiTokenScope('read');
                    if (
                        'buy' in request ||
                        'sell' in request ||
                        'proposal' in request ||
                        'transaction' in request ||
                        'proposal_open_contract' in request
                    ) {
                        assertApiTokenScope('trade');
                    }
                }
                return rawSend(request);
            };

            // Log all incoming messages
            deriv_socket.onmessage = (event) => {
                console.log('[Deriv] Incoming message:', event.data);
            };

            // Store the instance
            derivApiInstance = deriv_api;

            // Set up close handler to clear instance
            deriv_socket.addEventListener('close', (event) => {
                console.warn('[Deriv] WebSocket connection closed:', event.code, event.reason);
                if (derivApiInstance === deriv_api) {
                    derivApiInstance = null;
                    currentWebSocketURL = null;
                }
            });

            deriv_socket.addEventListener('error', error => {
                console.error('[Deriv] WebSocket connection error:', error);
            });

            return deriv_api;
        } catch (error) {
            console.error('[DerivAPI] Error creating instance:', error);
            derivApiPromise = null;
            derivApiInstance = null;
            throw error;
        } finally {
            // Clear the promise after a short delay to allow reuse during concurrent calls
            setTimeout(() => {
                derivApiPromise = null;
            }, 100);
        }
    })();

    return derivApiPromise;
};

export const getLoginId = () => {
    const login_id = localStorage.getItem('active_loginid');
    if (login_id && login_id !== 'null') return login_id;
    return null;
};

export const V2GetActiveAccountId = () => {
    const account_id = localStorage.getItem('active_loginid');
    if (account_id && account_id !== 'null') return account_id;
    return null;
};

/**
 * Returns true when the user is authenticated via the new PKCE / session-based
 * OAuth flow (token stored in sessionStorage['auth_info']).
 * In this mode the WebSocket URL itself is already authenticated via OTP, so
 * no per-account token is stored in localStorage and authorize() must be skipped.
 */
export const isPKCESession = () => {
    try {
        const authInfoStr = sessionStorage.getItem('auth_info');
        if (!authInfoStr) return false;
        const authInfo = JSON.parse(authInfoStr);
        // Treat as valid PKCE session only when the token hasn't expired
        if (authInfo?.expires_at && Date.now() >= authInfo.expires_at) return false;
        return !!authInfo?.access_token;
    } catch {
        return false;
    }
};

export const getToken = () => {
    const active_loginid = getLoginId();
    const pending_api_token = getPendingApiToken();

    if (pending_api_token && !active_loginid) {
        return {
            token: pending_api_token,
            account_id: undefined,
        };
    }

    // PKCE / session-based OAuth: the WebSocket URL is authenticated via OTP.
    // There is no per-account token in localStorage, so we return a sentinel
    // string so authorizeAndSubscribe() knows it can skip api.authorize().
    if (isPKCESession()) {
        console.log('[getToken] PKCE session detected — skipping legacy token lookup');
        return {
            token: '__PKCE_SESSION__',
            account_id: active_loginid ?? undefined,
        };
    }

    const accountsListRaw = localStorage.getItem('accountsList');
    let client_accounts;

    try {
        client_accounts = accountsListRaw ? JSON.parse(accountsListRaw) : undefined;
    } catch (e) {
        console.error('[getToken] Failed to parse accountsList:', e);
        client_accounts = undefined;
    }

    const active_account = (client_accounts && client_accounts[active_loginid]) || undefined;

    console.log('[getToken] Debug info:', {
        active_loginid,
        accountsListRaw: accountsListRaw ? 'Present' : 'Missing',
        client_accounts_keys: client_accounts ? Object.keys(client_accounts) : 'N/A',
        active_account_type: typeof active_account,
        active_account_value: active_account ? 'Present' : 'Missing',
        has_token: !!active_account,
    });

    return {
        token: active_account ?? undefined,
        account_id: active_loginid ?? undefined,
    };
};

// Backward compatibility aliases
export const V2GetActiveClientId = V2GetActiveAccountId;
export const V2GetActiveToken = getToken;
