/**
 * WebSocket Session Endpoint
 * Creates and manages WebSocket sessions for new wallet accounts (DOT/ROT)
 * Returns WebSocket URL and session ID for frontend connection
 *
 * Supports:
 * - DOT (crypto wallet) accounts
 * - ROT (real wallet) accounts
 * - Real-time balance updates
 * - Account information fetching
 */

import { URLSearchParams } from 'url';

function parseCookies(cookieHeader) {
    const list = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(function (cookie) {
        const parts = cookie.split('=');
        const key = parts.shift().trim();
        const value = parts.join('=');
        list[key] = decodeURIComponent(value);
    });
    return list;
}

/**
 * Create WebSocket session with OTP for new wallet account
 * Deriv requires OTP-based session for WebSocket authentication
 */
async function createWebSocketSession(accessToken, accountId, appId) {
    try {
        console.log(`[WS] Creating session for account ${accountId}`);

        const params = new URLSearchParams({
            action: 'otp_session_request',
            account_id: accountId,
        });

        const response = await fetch('https://api.deriv.com/api/v3', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Bearer ${accessToken}`,
                'Deriv-App-Id': appId,
            },
            body: params.toString(),
        });

        if (!response.ok) {
            throw new Error(`OTP session request failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.otp_session_request || data.error) {
            throw new Error(`Session creation failed: ${data.error}`);
        }

        return {
            session_id: data.otp_session_request.session_id,
            ws_url: data.otp_session_request.ws_url || 'wss://ws.deriv.com/websockets/v3',
        };
    } catch (error) {
        console.error('[WS] Session creation error:', error);
        throw error;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get cookies and support token passed in request body for services that do not use cookie-based auth
        const cookies = parseCookies(req.headers.cookie || '');
        const accessToken = cookies.deriv_access_token || req.body?.access_token;
        const appId = cookies.deriv_app_id || req.body?.app_id || process.env.DERIV_LEGACY_APP_ID;

        if (!accessToken) {
            return res.status(401).json({
                error: 'unauthorized',
                error_description: 'No access token found',
            });
        }

        // Parse request body
        const { account_id, account_type } = req.body || {};

        if (!account_id) {
            return res.status(400).json({
                error: 'invalid_request',
                error_description: 'Missing account_id',
            });
        }

        // Validate account type is new wallet (DOT/ROT)
        if (!['dot', 'rot'].includes(account_type)) {
            return res.status(400).json({
                error: 'invalid_account_type',
                error_description: 'Only DOT and ROT accounts support WebSocket sessions',
            });
        }

        // Create OTP session
        const sessionData = await createWebSocketSession(accessToken, account_id, appId);

        // Set session cookie if needed
        const sessionCookie = `ws_session_${account_id}=${encodeURIComponent(
            JSON.stringify(sessionData)
        )}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`;

        res.setHeader('Set-Cookie', sessionCookie);

        return res.status(200).json({
            session_id: sessionData.session_id,
            ws_url: sessionData.ws_url,
            expires_in: 3600,
            account_id: account_id,
            account_type: account_type,
        });
    } catch (error) {
        console.error('[WS] Endpoint error:', error);
        return res.status(500).json({
            error: 'websocket_session_failed',
            error_description: error instanceof Error ? error.message : String(error),
        });
    }
}
