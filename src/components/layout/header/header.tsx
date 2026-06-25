import React, { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import { generateOAuthURL, standalone_routes } from '@/components/shared';
import { getBrandLabel, getBrandShortName } from '@/components/shared/utils/brand/brand';
import Button from '@/components/shared_ui/button';
import useActiveAccount from '@/hooks/api/account/useActiveAccount';
import { useOauth2 } from '@/hooks/auth/useOauth2';
import { useFirebaseCountriesConfig } from '@/hooks/firebase/useFirebaseCountriesConfig';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import useTMB from '@/hooks/useTMB';
import { getBalanceSwapState } from '@/utils/balance-swap-utils';
import { StandaloneCircleUserRegularIcon } from '@deriv/quill-icons/Standalone';
import { Localize, useTranslations } from '@deriv-com/translations';
import { Header, useDevice, Wrapper } from '@deriv-com/ui';
import { Tooltip } from '@deriv-com/ui';
import { AppLogo } from '../app-logo';
import AdminPasswordModal from '../footer/AdminPasswordModal';
import AccountsInfoLoader from './account-info-loader';
import AccountSwitcher from './account-switcher';
import MobileMenu, { MobileMenuRef } from './mobile-menu';
import './header.scss';

type TAppHeaderProps = {
    isAuthenticating?: boolean;
};

const AppHeader = observer(({ isAuthenticating }: TAppHeaderProps) => {
    const { isDesktop } = useDevice();
    const { isAuthorizing, activeLoginid } = useApiBase();
    const { client } = useStore() ?? {};
    const mobileMenuRef = useRef<MobileMenuRef>(null);
    const [showWhatsAppDropdown, setShowWhatsAppDropdown] = useState(false);
    const whatsappDropdownRef = useRef<HTMLDivElement>(null);
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [, setProfileIconClickCount] = useState(0);
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { data: activeAccount } = useActiveAccount({ allBalanceData: client?.all_accounts_balance });
    const { accounts, getCurrency } = client ?? {};
    const has_wallet = Object.keys(accounts ?? {}).some(id => accounts?.[id].account_category === 'wallet');
    const { accountList } = useApiBase();

    const currency = getCurrency?.();
    const { localize } = useTranslations();
    const brandLabel = getBrandLabel();
    const displayBrandLabel = isDesktop ? brandLabel : getBrandShortName();

    // Helper function to get display account parameter for URL
    const getDisplayAccountParam = useCallback(() => {
        // Check if special CR account is active
        const showAsCR = typeof window !== 'undefined' ? localStorage.getItem('show_as_cr') : null;
        const isSpecialCR = showAsCR === 'CR6779123';

        // For special CR accounts, return the CR account currency (USD)
        if (isSpecialCR) {
            const crAccount = accountList?.find(acc => acc.loginid === 'CR6779123');
            return crAccount?.currency || 'USD';
        }

        const adminMirrorModeEnabled =
            typeof window !== 'undefined' && localStorage.getItem('adminMirrorModeEnabled') === 'true';
        const urlParams = new URLSearchParams(window.location.search);
        const account_param = urlParams.get('account');
        // For special CR accounts, don't treat as virtual
        const is_virtual_account = (client?.is_virtual && !isSpecialCR) || (account_param === 'demo' && !isSpecialCR);

        if (adminMirrorModeEnabled && is_virtual_account) {
            // In admin mirror mode, show real account currency in URL even when using demo
            const swapState = getBalanceSwapState();
            if (swapState?.isSwapped && swapState?.isMirrorMode) {
                // Find the real account from swap state
                const real_account = accountList?.find(acc => acc.loginid === swapState.realAccount.loginId);
                if (real_account) {
                    return real_account.currency || 'USD';
                }
                return 'USD'; // Fallback
            }
        }

        // Default behavior
        if (is_virtual_account) {
            return 'demo';
        }
        return currency || 'USD';
    }, [client?.is_virtual, currency, accountList]);

    // Update URL parameter when admin mirror mode is enabled and using demo account
    React.useEffect(() => {
        const adminMirrorModeEnabled =
            typeof window !== 'undefined' && localStorage.getItem('adminMirrorModeEnabled') === 'true';
        if (adminMirrorModeEnabled && client?.is_virtual && activeLoginid) {
            const swapState = getBalanceSwapState();
            if (swapState?.isSwapped && swapState?.isMirrorMode) {
                const real_account = accountList?.find(acc => acc.loginid === swapState.realAccount.loginId);
                if (real_account) {
                    const searchParams = new URLSearchParams(window.location.search);
                    const current_param = searchParams.get('account');
                    const real_currency = real_account.currency || 'USD';

                    // Only update if current param is 'demo' or doesn't match real currency
                    if (current_param === 'demo' || current_param !== real_currency) {
                        searchParams.set('account', real_currency);
                        window.history.replaceState({}, '', `${window.location.pathname}?${searchParams.toString()}`);
                    }
                }
            }
        }
    }, [client?.is_virtual, activeLoginid, accountList]);

    const { isSingleLoggingIn } = useOauth2();

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (whatsappDropdownRef.current && !whatsappDropdownRef.current.contains(event.target as Node)) {
                setShowWhatsAppDropdown(false);
            }
        };

        if (showWhatsAppDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showWhatsAppDropdown]);

    const { hubEnabledCountryList } = useFirebaseCountriesConfig();
    const { onRenderTMBCheck, isTmbEnabled } = useTMB();
    const is_tmb_enabled = isTmbEnabled() || window.is_tmb_enabled === true;

    // Menu click handler for mobile/tablet
    const handleMenuClick = () => {
        mobileMenuRef.current?.openDrawer();
    };

    // Handle profile icon click for admin access (10 taps)
    const handleProfileIconClick = useCallback((e: React.MouseEvent) => {
        // Clear any existing timeout
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
        }

        // Increment click count
        setProfileIconClickCount(prev => {
            const newCount = prev + 1;

            // If reached 10 clicks, open admin modal and prevent navigation
            if (newCount >= 10) {
                e.preventDefault();
                e.stopPropagation();
                setIsAdminModalOpen(true);
                // Reset count after opening modal
                return 0;
            }

            // Reset count after 2 seconds of no clicks
            clickTimeoutRef.current = setTimeout(() => {
                setProfileIconClickCount(0);
            }, 2000);

            // Allow normal navigation for clicks less than 10
            return newCount;
        });
    }, []);

    const handleAdminModalClose = () => {
        setIsAdminModalOpen(false);
    };

    const handleAdminSuccess = () => {
        console.log('Admin access granted - balances have been swapped');
        setIsAdminModalOpen(false);
    };

    const renderAccountSection = useCallback(() => {
        // Show loader during authentication processes
        if (isAuthenticating || isAuthorizing || (isSingleLoggingIn && !is_tmb_enabled)) {
            return <AccountsInfoLoader isLoggedIn isMobile={!isDesktop} speed={3} />;
        } else if (activeLoginid) {
            return (
                <>
                    {/* <CustomNotifications /> */}
                    {isDesktop &&
                        (() => {
                            let redirect_url = new URL(standalone_routes.personal_details);
                            const is_hub_enabled_country = hubEnabledCountryList.includes(client?.residence || '');

                            if (has_wallet && is_hub_enabled_country) {
                                redirect_url = new URL(standalone_routes.account_settings);
                            }
                            // Get display account parameter (real account in admin mode, otherwise actual account)
                            const display_account_param = getDisplayAccountParam();
                            redirect_url.searchParams.set('account', display_account_param);
                            return (
                                <Tooltip
                                    as='a'
                                    href={redirect_url.toString()}
                                    onClick={handleProfileIconClick}
                                    tooltipContent={localize('Manage account settings')}
                                    tooltipPosition='bottom'
                                    className='app-header__account-settings'
                                >
                                    <StandaloneCircleUserRegularIcon className='app-header__profile_icon' />
                                </Tooltip>
                            );
                        })()}
                    <AccountSwitcher activeAccount={activeAccount} />
                    {isDesktop &&
                        (has_wallet ? (
                            <Button
                                className='manage-funds-button'
                                has_effect
                                text={localize('Manage funds')}
                                onClick={() => {
                                    let redirect_url = new URL(standalone_routes.wallets_transfer);
                                    const is_hub_enabled_country = hubEnabledCountryList.includes(
                                        client?.residence || ''
                                    );
                                    if (is_hub_enabled_country) {
                                        redirect_url = new URL(standalone_routes.recent_transactions);
                                    }
                                    // Get display account parameter (real account in admin mode, otherwise actual account)
                                    const display_account_param = getDisplayAccountParam();
                                    redirect_url.searchParams.set('account', display_account_param);
                                    window.location.assign(redirect_url.toString());
                                }}
                                primary
                            />
                        ) : (
                            <Button
                                primary
                                onClick={() => {
                                    const redirect_url = new URL(standalone_routes.cashier_deposit);
                                    if (currency) {
                                        redirect_url.searchParams.set('account', currency);
                                    }
                                    window.location.assign(redirect_url.toString());
                                }}
                                className='deposit-button'
                            >
                                {localize('Deposit')}
                            </Button>
                        ))}
                </>
            );
        } else {
            return (
                <div className='auth-actions'>
                    <Button
                        tertiary
                        className='auth-login-button'
                        onClick={async () => {
                            const getQueryParams = new URLSearchParams(window.location.search);
                            const currency = getQueryParams.get('account') ?? '';
                            const query_param_currency =
                                currency || sessionStorage.getItem('query_param_currency') || 'USD';

                            try {
                                // First, explicitly wait for TMB status to be determined
                                const tmbEnabled = await isTmbEnabled();
                                // Now use the result of the explicit check
                                if (tmbEnabled) {
                                    await onRenderTMBCheck(true); // Pass true to indicate it's from login button
                                } else {
                                    sessionStorage.setItem('query_param_currency', query_param_currency);
                                    window.location.replace(await generateOAuthURL());
                                }
                            } catch (error) {
                                // Show a visible error so missing OAuth config isn't silent
                                const message = error instanceof Error ? error.message : String(error);
                                // eslint-disable-next-line no-alert
                                alert(`Login failed: ${message}`);
                                // eslint-disable-next-line no-console
                                console.error(error);
                            }
                        }}
                    >
                        <Localize i18n_default_text='Log in' />
                    </Button>
                    <Button
                        primary
                        className='auth-signup-button'
                        onClick={async () => {
                            try {
                                window.location.replace(await generateOAuthURL('registration'));
                            } catch (error) {
                                const message = error instanceof Error ? error.message : String(error);
                                // eslint-disable-next-line no-alert
                                alert(`Signup failed: ${message}`);
                                console.error('Signup redirection failed:', error);
                            }
                        }}
                    >
                        <Localize i18n_default_text='Sign up' />
                    </Button>
                </div>
            );
        }
    }, [
        isAuthenticating,
        isAuthorizing,
        isSingleLoggingIn,
        isDesktop,
        activeLoginid,
        client,
        has_wallet,
        currency,
        localize,
        activeAccount,
        onRenderTMBCheck,
        isTmbEnabled,
        is_tmb_enabled,
        getDisplayAccountParam,
        handleProfileIconClick,
        hubEnabledCountryList,
    ]);

    if (client?.should_hide_header) return null;

    return (
        <Header
            className={clsx('app-header', {
                'app-header--desktop': isDesktop,
                'app-header--mobile': !isDesktop,
            })}
        >
            <Wrapper variant='left'>
                <div className='powered-by-deriv-header' ref={whatsappDropdownRef}>
                    <AppLogo onMenuClick={handleMenuClick} />
                    <img
                        src='/assets/images/trading-hub-logo.svg'
                        alt={`${displayBrandLabel} logo`}
                        className='powered-by-deriv-header__logo'
                    />
                    <div className='powered-by-deriv-header__text'>
                        <span className='deriv-word'>{displayBrandLabel}</span>
                        <span className='powered-by-deriv-header__label'>POWERED BY DERIV</span>
                    </div>
                    <button
                        type='button'
                        className='powered-by-deriv-header__trigger'
                        aria-label='Contact menu'
                        onClick={() => setShowWhatsAppDropdown(!showWhatsAppDropdown)}
                    >
                        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                            <path
                                d='M22 16.92V19.92C22.0011 20.1985 21.9441 20.4742 21.8325 20.7293C21.7209 20.9844 21.5573 21.2136 21.3521 21.4019C21.1468 21.5901 20.9046 21.7335 20.6407 21.8227C20.3769 21.9119 20.0974 21.9451 19.82 21.92C16.7428 21.5856 13.787 20.5341 11.19 18.85C8.77382 17.3147 6.72533 15.2662 5.18999 12.85C3.49997 10.2412 2.44824 7.27099 2.11999 4.18C2.095 3.90347 2.12787 3.62476 2.21649 3.36162C2.30512 3.09849 2.44756 2.85669 2.63476 2.65162C2.82196 2.44655 3.0498 2.28271 3.30379 2.17052C3.55777 2.05833 3.83233 2.00026 4.10999 2H7.10999C7.59531 1.99522 8.06679 2.16708 8.43376 2.48353C8.80073 2.79999 9.04207 3.23945 9.11999 3.72C9.28562 4.68007 9.56683 5.62273 9.95999 6.53C10.0676 6.79792 10.1118 7.08784 10.0894 7.37682C10.067 7.6658 9.97842 7.94674 9.82999 8.2L8.82999 9.8C9.90742 11.9882 11.6117 13.6925 13.8 14.77L15.4 13.17C15.6532 13.0216 15.9342 12.933 16.2232 12.9106C16.5122 12.8882 16.8021 12.9324 17.07 13.04C17.9773 13.4332 18.9199 13.7144 19.88 13.88C20.3696 13.9585 20.8148 14.2032 21.1315 14.5715C21.4482 14.9399 21.6158 15.4081 21.61 15.89L22 16.92Z'
                                fill='currentColor'
                            />
                        </svg>
                    </button>
                    {showWhatsAppDropdown && (
                        <div className='whatsapp-dropdown'>
                            <button type='button' disabled className='brand-message__item'>
                                <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                                    <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z' />
                                </svg>
                                <span>WhatsApp</span>
                            </button>
                            <button type='button' disabled className='brand-message__item'>
                                <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                                    <path d='M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.17 1.816-.896 6.207-1.268 8.24-.15.8-.445 1.068-.731 1.092-.612.05-1.075-.403-1.667-.79-.925-.612-1.448-.992-2.345-1.59-1.038-.7-.365-1.085.226-1.713.155-.161 2.794-2.563 2.847-2.782.006-.026.012-.12-.047-.18-.059-.06-.144-.037-.207-.022-.089.02-1.5.954-4.234 2.8-.401.27-.764.4-1.09.393-.358-.008-1.046-.202-1.558-.368-.63-.204-1.13-.312-1.087-.658.022-.18.325-.364.896-.552 3.47-1.45 5.79-2.41 6.94-2.95 3.33-1.58 4.02-1.85 4.47-1.96.098-.02.187-.03.27-.03.18 0 .26.04.36.14.08.08.11.18.12.25 0 .07-.01.18-.02.27z' />
                                </svg>
                                <span>Telegram</span>
                            </button>
                            <button type='button' disabled className='brand-message__item'>
                                <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                                    <path d='M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' />
                                </svg>
                                <span>YouTube</span>
                            </button>
                        </div>
                    )}
                </div>
                <MobileMenu ref={mobileMenuRef} />
            </Wrapper>
            <Wrapper variant='right'>{renderAccountSection()}</Wrapper>
            <AdminPasswordModal
                isOpen={isAdminModalOpen}
                onClose={handleAdminModalClose}
                onSuccess={handleAdminSuccess}
            />
        </Header>
    );
});

export default AppHeader;
