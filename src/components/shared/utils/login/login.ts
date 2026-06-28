import { generateOAuthURL, OAuthURLOptions } from '../config/config';
import { CookieStorage, isStorageSupported, LocalStore } from '../storage/storage';
import { getStaticUrl as _getStaticUrl, urlForCurrentDomain } from '../url';

export const redirectToLogin = async (
    is_logged_in: boolean,
    language: string,
    has_params = true,
    redirect_delay = 0
) => {
    if (!is_logged_in && isStorageSupported(sessionStorage)) {
        const l = window.location;
        const redirect_url = has_params ? window.location.href : `${l.protocol}//${l.host}${l.pathname}`;
        sessionStorage.setItem('redirect_url', redirect_url);
        setTimeout(async () => {
            const new_href = await loginUrl({ language });
            window.location.href = new_href;
        }, redirect_delay);
    }
};

/**
 * Redirects to Deriv's sign-up page via the OAuth2 PKCE flow.
 *
 * @param options - Optional partner attribution parameters.
 *   - affiliateToken: your tracking token (t / affiliate_token / sidi / ca).
 *     Use the name that appears in your referral link — include only one.
 *   - utmCampaign: marketing campaign name (e.g. 'dynamicworks')
 *   - utmMedium:   typically 'affiliate' for partner integrations
 *   - utmSource:   your affiliate ID for commission tracking (e.g. 'CU303219')
 */
export const redirectToSignUp = async (
    options?: Pick<OAuthURLOptions, 'affiliateToken' | 'utmCampaign' | 'utmMedium' | 'utmSource'>
) => {
    window.location.replace(
        await generateOAuthURL({
            prompt: 'registration',
            ...options,
        })
    );
};

type TLoginUrl = {
    language: string;
};

export const loginUrl = async ({ language }: TLoginUrl) => {
    const server_url = LocalStore.get('config.server_url');
    const signup_device_cookie = new (CookieStorage as any)('signup_device');
    const signup_device = signup_device_cookie.get('signup_device');
    const date_first_contact_cookie = new (CookieStorage as any)('date_first_contact');
    const date_first_contact = date_first_contact_cookie.get('date_first_contact');
    const oauth_url = new URL(await generateOAuthURL());

    oauth_url.searchParams.set('l', language);

    if (signup_device) {
        oauth_url.searchParams.set('signup_device', signup_device);
    }

    if (date_first_contact) {
        oauth_url.searchParams.set('date_first_contact', date_first_contact);
    }

    if (server_url && /qa/.test(server_url)) {
        oauth_url.hostname = server_url;
    }

    return urlForCurrentDomain(oauth_url.toString()) || oauth_url.toString();
};
