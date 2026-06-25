/**
 * OAuth2 Token Refresh Endpoint
 * Handles refresh_token grant to get new access_token
 * Implements proper token refresh flow with error handling
 *
 * Call this endpoint when:
 * - Access token is expiring soon (5 min before)
 * - Access token returns 401 Unauthorized
 * - Auto-refresh timer triggers
 */

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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const cookies = parseCookies(req.headers.cookie || '');
        const refresh_token = cookies.deriv_refresh_token;
        const app_id = normalizeValue(
            cookies.deriv_app_id ||
            process.env.APP_ID ||
            process.env.OAUTH_LEGACY_APP_ID ||
            process.env.DERIV_LEGACY_APP_ID
        );

        if (!refresh_token) {
            return res.status(400).json({
                error: 'no_refresh_token',
                error_description: 'No refresh token available. Please login again.',
            });
        }

        const client_id = normalizeValue(process.env.DERIV_OAUTH_CLIENT_ID || process.env.DERIV_APP_ID || '');
        const client_secret = normalizeValue(process.env.DERIV_CLIENT_SECRET || '');

        if (!client_id) {
            return res.status(500).json({
                error: 'configuration_error',
                error_description: 'Server OAuth configuration incomplete',
            });
        }

        // Prepare token refresh request
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token,
            client_id,
            ...(client_secret ? { client_secret } : {}),
        });

        // Send refresh request to Deriv
        const response = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Trading-Bot/1.0',
            },
            body: params.toString(),
        });

        const tokenData = await response.json();

        if (!response.ok) {
            console.error('Token refresh failed:', tokenData);

            // Handle specific refresh errors
            if (tokenData.error === 'invalid_grant') {
                // Refresh token expired or invalid - user must login again
                return res.status(400).json({
                    error: 'refresh_token_expired',
                    error_description: 'Refresh token expired. Please login again.',
                });
            }

            return res.status(response.status).json(tokenData);
        }

        // Validate new token response
        if (!tokenData.access_token) {
            return res.status(500).json({
                error: 'invalid_token_response',
                error_description: 'No access token in refresh response',
            });
        }

        // Update cookies with new tokens
        const isProd = process.env.NODE_ENV === 'production';
        const cookieOpts = ['HttpOnly', 'Path=/', 'SameSite=Strict'];
        if (isProd) {
            cookieOpts.push('Secure');
        }
        const cookieString = cookieOpts.join('; ');

        const expires_in = tokenData.expires_in || 3600;
        const expires_at = Date.now() + expires_in * 1000;

        const setCookies = [
            `deriv_access_token=${encodeURIComponent(tokenData.access_token)}; ${cookieString}; Max-Age=${expires_in}`,
            `deriv_token_expires_at=${encodeURIComponent(expires_at.toString())}; ${cookieString}; Max-Age=${expires_in}`,
        ];

        // Update refresh token if new one was issued
        if (tokenData.refresh_token) {
            setCookies.push(
                `deriv_refresh_token=${encodeURIComponent(tokenData.refresh_token)}; ${cookieString}; Max-Age=604800`
            );
        }

        res.setHeader('Set-Cookie', setCookies);

        // Return new token info to frontend
        return res.status(200).json({
            access_token: tokenData.access_token,
            token_type: tokenData.token_type || 'Bearer',
            expires_in: expires_in,
            expires_at: expires_at,
            scope: tokenData.scope || 'trade',
        });
    } catch (err) {
        console.error('Token refresh error:', err);
        return res.status(500).json({
            error: 'refresh_error',
            error_description: err instanceof Error ? err.message : String(err),
        });
    }
}
