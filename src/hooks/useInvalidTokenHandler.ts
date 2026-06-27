import { useEffect } from 'react';
import { ErrorLogger } from '@/utils/error-logger';

export function useInvalidTokenHandler(): { unregisterHandler: () => void } {
    const handleInvalidToken = async () => {
        try {
            sessionStorage.removeItem('auth_info');
            localStorage.removeItem('active_loginid');
            localStorage.removeItem('authToken');
            localStorage.removeItem('accountsList');
            localStorage.removeItem('clientAccounts');
            sessionStorage.clear();

            const { generateOAuthURL } = await import('@/components/shared/utils/config/config');
            const oauthUrl = await generateOAuthURL();

            if (oauthUrl) {
                window.location.replace(oauthUrl);
            } else {
                ErrorLogger.error('InvalidToken', 'Failed to generate OAuth URL');
                window.location.reload();
            }
        } catch (error) {
            ErrorLogger.error('InvalidToken', 'Error handling invalid token', error);
            window.location.reload();
        }
    };

    // Note: We would normally register this to a global event here.
    // For now, we just return an unregister function that does nothing.

    return {
        unregisterHandler: () => {},
    };
}
