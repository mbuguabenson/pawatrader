import { useCallback } from 'react';
import { clearApiTokenSession } from '@/utils/api-token-permissions';
import { ErrorLogger } from '@/utils/error-logger';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';

export function useLogout(): () => Promise<void> {
    return useCallback(async () => {
        try {
            // Clear auth info first
            OAuthTokenExchangeService.clearAuthInfo();
            // Clear API token session
            clearApiTokenSession();
            // Clear all auth-related storage
            sessionStorage.removeItem('auth_info');
            localStorage.removeItem('authToken');
            localStorage.removeItem('active_loginid');
            localStorage.removeItem('accountsList');
            localStorage.removeItem('clientAccounts');
            localStorage.removeItem('account_type');
            localStorage.removeItem('callback_token');
            // Reload the page to clear everything
            window.location.reload();
        } catch (error) {
            ErrorLogger.error('Logout', 'Logout failed', error);
            // Fallback clear
            try {
                sessionStorage.clear();
                localStorage.clear();
                window.location.reload();
            } catch (finalError) {
                ErrorLogger.error('Logout', 'Failed to clear all storage', finalError);
            }
        }
    }, []);
}
