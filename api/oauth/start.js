import crypto from 'crypto';

function base64URLEncode(buffer) {
    return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}

function randomString(length = 64) {
    return base64URLEncode(crypto.randomBytes(length));
}

const normalizeValue = value =>
    typeof value === 'string' ? value.replace(/[\r\n]+/g, '').trim() : value;

export default async function handler(req, res) {
    // Only GET supported: redirect to the Deriv authorization endpoint
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const query = req.query || {};

        // Use client_id passed as query or fallback to env var
        const client_id = normalizeValue(
            query.client_id ||
            process.env.DERIV_OAUTH_CLIENT_ID ||
            process.env.OAUTH_CLIENT_ID ||
            process.env.CLIENT_ID
        );
        const app_id = normalizeValue(
            query.app_id ||
            process.env.APP_ID ||
            process.env.OAUTH_LEGACY_APP_ID ||
            process.env.DERIV_LEGACY_APP_ID
        );
        const redirect_uri = normalizeValue(
            query.redirect_uri ||
            process.env.DERIV_REDIRECT_URI ||
            process.env.OAUTH_REDIRECT_URI ||
            process.env.REDIRECT_URI
        );

        if ((!client_id && !app_id) || !redirect_uri) {
            return res.status(500).json({ error: 'Missing server configuration for client_id or app_id, or redirect_uri' });
        }

        const preferred_account = query.account || query.preferred_account || '';

        // Generate PKCE code_verifier and state
        const code_verifier = randomString(64);
        const code_challenge = base64URLEncode(sha256(code_verifier));
        const state = randomString(32);

        // Set HttpOnly cookies to keep code_verifier, state, preferred account, and OAuth request metadata server-side
        const isProd = process.env.NODE_ENV === 'production';
        const cookieOpts = [`HttpOnly`, `Path=/`, isProd ? `SameSite=None` : `SameSite=Lax`];
        if (isProd) cookieOpts.push('Secure');

        const cookies = [
            `oauth_code_verifier=${encodeURIComponent(code_verifier)}; ${cookieOpts.join('; ')}; Max-Age=600`,
            `oauth_state=${encodeURIComponent(state)}; ${cookieOpts.join('; ')}; Max-Age=600`,
            `oauth_redirect_uri=${encodeURIComponent(redirect_uri)}; ${cookieOpts.join('; ')}; Max-Age=600`,
        ];

        if (client_id) {
            cookies.push(`oauth_client_id=${encodeURIComponent(client_id)}; ${cookieOpts.join('; ')}; Max-Age=600`);
        }
        if (app_id) {
            cookies.push(`oauth_app_id=${encodeURIComponent(app_id)}; ${cookieOpts.join('; ')}; Max-Age=600`);
        }

        if (preferred_account) {
            cookies.push(`oauth_preferred_account=${encodeURIComponent(preferred_account)}; ${cookieOpts.join('; ')}; Max-Age=600`);
        }

        res.setHeader('Set-Cookie', cookies);

        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri,
            scope: 'trade',
            state,
            code_challenge,
            code_challenge_method: 'S256',
        });

        if (client_id) {
            params.set('client_id', client_id);
        } else if (app_id) {
            params.set('app_id', app_id);
        }

        Object.entries(query).forEach(([key, value]) => {
            if (
                ![
                    'client_id',
                    'app_id',
                    'redirect_uri',
                    'scope',
                    'state',
                    'code_challenge',
                    'code_challenge_method',
                    'response_type',
                    'account',
                    'preferred_account',
                ].includes(key) &&
                value
            ) {
                params.set(key, String(value));
            }
        });

        const authUrl = `https://auth.deriv.com/oauth2/auth?${params.toString()}`;

        // Redirect the browser to Deriv's authorization endpoint
        return res.writeHead(302, { Location: authUrl }).end();
    } catch (err) {
        return res
            .status(500)
            .json({ error: 'oauth_start_failed', error_description: err instanceof Error ? err.message : String(err) });
    }
}
