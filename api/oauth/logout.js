/**
 * OAuth2 Logout Endpoint
 * Clears all server-side session and cookies
 * Called when user clicks logout or session expires
 *
 * Clears:
 * - Access token
 * - Refresh token
 * - Token expiry
 * - Selected account
 * - Session cookies
 */

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

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Clear all OAuth and session cookies
        const isProd = process.env.NODE_ENV === 'production';
        const cookieOpts = ['Path=/', 'Max-Age=0'];
        if (isProd) {
            cookieOpts.push('Secure');
        }
        const cookieString = cookieOpts.join('; ');

        const clearCookies = [
            `deriv_access_token=; ${cookieString}; HttpOnly; SameSite=Strict`,
            `deriv_refresh_token=; ${cookieString}; HttpOnly; SameSite=Strict`,
            `deriv_token_expires_at=; ${cookieString}; HttpOnly; SameSite=Strict`,
            `deriv_selected_account=; ${cookieString}; HttpOnly; SameSite=Strict`,
            `deriv_app_id=; ${cookieString}`,
            `logged_state=; ${cookieString}`,
            `oauth_code_verifier=; ${cookieString}; HttpOnly; SameSite=Strict`,
            `oauth_state=; ${cookieString}; HttpOnly; SameSite=Strict`,
            `oauth_preferred_account=; ${cookieString}; HttpOnly; SameSite=Strict`,
        ];

        res.setHeader('Set-Cookie', clearCookies);

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (err) {
        console.error('Logout error:', err);
        return res.status(500).json({
            error: 'logout_error',
            error_description: err instanceof Error ? err.message : String(err),
        });
    }
}
