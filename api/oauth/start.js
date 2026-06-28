import crypto from 'crypto';

function base64URLEncode(buffer) {
    return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64URLDecode(str) {
    let s = str.replace(/\-/g, '+').replace(/_/g, '/');
    switch (s.length % 4) {
        case 0: break;
        case 2: s += '=='; break;
        case 3: s += '='; break;
        default: throw new Error('Invalid base64url string');
    }
    return Buffer.from(s, 'base64');
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}

function randomString(length = 64) {
    return base64URLEncode(crypto.randomBytes(length));
}

// Encrypt PKCE data into a single signed token
function createPKCEToken(code_verifier, state, client_id, redirect_uri) {
    const data = JSON.stringify({ code_verifier, state, client_id, redirect_uri, ts: Date.now() });
    const secret = process.env.OAUTH_SECRET || 'fallback-secret-change-in-production';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    const signature = base64URLEncode(hmac.digest());
    return `${base64URLEncode(Buffer.from(data))}.${signature}`;
}

// Verify and decrypt PKCE token
function verifyPKCEToken(token) {
    try {
        if (!token) return null;
        const [dataB64, signature] = token.split('.');
        const dataBuffer = base64URLDecode(dataB64);
        const data = JSON.parse(dataBuffer.toString());
        const secret = process.env.OAUTH_SECRET || 'fallback-secret-change-in-production';
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(JSON.stringify(data));
        const expectedSig = base64URLEncode(hmac.digest());
        if (signature !== expectedSig) return null;
        
        // Verify token is not older than 10 minutes
        if (Date.now() - data.ts > 600000) return null;
        return data;
    } catch (err) {
        return null;
    }
}

const normalizeValue = value =>
    typeof value === 'string' ? value.replace(/[\r\n]+/g, '').trim() : value;

const getCookieOptions = req => {
    // On Vercel/production, always use secure cross-site cookies for OAuth flow
    const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
    const secure = isProduction || forwardedProto === 'https';
    
    const cookieOpts = [`HttpOnly`, `Path=/`, `Max-Age=600`];
    
    // For OAuth cross-origin redirects, always use SameSite=None with Secure
    if (secure) {
        cookieOpts.push('SameSite=None', 'Secure');
    } else {
        cookieOpts.push('SameSite=Lax');
    }

    return cookieOpts;
};

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
            process.env.REDIRECT_URI ||
            'https://brixxie-theta.vercel.app/api/oauth/callback'
        );

        if ((!client_id && !app_id) || !redirect_uri) {
            return res.status(500).json({ error: 'Missing server configuration for client_id or app_id, or redirect_uri' });
        }

        const preferred_account = query.account || query.preferred_account || '';

        // Generate PKCE code_verifier and state
        const code_verifier = randomString(64);
        const code_challenge = base64URLEncode(sha256(code_verifier));
        const state_random = randomString(32);
        
        // Create encrypted token containing all PKCE data
        const pkceToken = createPKCEToken(code_verifier, state_random, client_id, redirect_uri);
        
        // Use the token as the OAuth state parameter (will be returned by Deriv)
        const state = pkceToken;

        // Still set cookies as fallback for traditional flow
        const cookieOpts = getCookieOptions(req);
        const useClientId = Boolean(client_id);
        const useAppId = !useClientId && Boolean(app_id);

        const cookies = [
            `oauth_code_verifier=${encodeURIComponent(code_verifier)}; ${cookieOpts.join('; ')}`,
            `oauth_state=${encodeURIComponent(state_random)}; ${cookieOpts.join('; ')}`,
            `oauth_pkce_token=${encodeURIComponent(pkceToken)}; ${cookieOpts.join('; ')}`,
            `oauth_redirect_uri=${encodeURIComponent(redirect_uri)}; ${cookieOpts.join('; ')}`,
        ];

        if (useClientId) {
            cookies.push(`oauth_client_id=${encodeURIComponent(client_id)}; ${cookieOpts.join('; ')}`);
        } else if (useAppId) {
            cookies.push(`oauth_app_id=${encodeURIComponent(app_id)}; ${cookieOpts.join('; ')}`);
        }

        if (preferred_account) {
            cookies.push(`oauth_preferred_account=${encodeURIComponent(preferred_account)}; ${cookieOpts.join('; ')}`);
        }

        res.setHeader('Set-Cookie', cookies);

        console.log('[OAuth Start] Cookies header:', {
            count: cookies.length,
            cookies: cookies.map(c => c.substring(0, 50)),
        });

        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri,
            scope: 'trade account_manage',
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

        // Sign-up: pass prompt=registration to show the sign-up form
        // Partner attribution: pass optional tracking / UTM parameters
        // (t, affiliate_token, sidi, ca are equivalent aliases — use whichever is present)
        const SIGN_UP_PASSTHROUGH_PARAMS = [
            'prompt',          // 'registration' for sign-up
            't',               // affiliate tracking token (alias 1)
            'affiliate_token', // affiliate tracking token (alias 2)
            'sidi',            // affiliate tracking token (alias 3)
            'ca',              // affiliate tracking token (alias 4)
            'utm_campaign',
            'utm_medium',
            'utm_source',
        ];
        SIGN_UP_PASSTHROUGH_PARAMS.forEach(key => {
            const val = query[key];
            if (val && !params.has(key)) {
                params.set(key, String(val));
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
