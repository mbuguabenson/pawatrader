import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { botNotification } from '@/components/bot-notification/bot-notification';
import { localize } from '@deriv-com/translations';
import { notification_message } from '@/components/bot-notification/bot-notification-utils';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { useDevice } from '@deriv-com/ui';
import LoadModal from '../../components/load-modal';
import SaveModal from '../dashboard/bot-list/save-modal';
import BotBuilderTourHandler from '../tutorials/dbot-tours/bot-builder-tour';
import QuickStrategy1 from './quick-strategy';
import WorkspaceWrapper from './workspace-wrapper';

const BotBuilder = observer(() => {
    const { dashboard, app, run_panel, toolbar, quick_strategy, blockly_store } = useStore();
    const { active_tab, active_tour, is_preview_on_popup } = dashboard;
    const { is_open } = quick_strategy;
    const { is_running } = run_panel;
    const { is_loading } = blockly_store;
    const is_blockly_listener_registered = React.useRef(false);
    const is_blockly_delete_listener_registered = React.useRef(false);
    const { isDesktop } = useDevice();
    const { onMount, onUnmount } = app;
    const el_ref = React.useRef<HTMLInputElement | null>(null);
    const [workspaceInitFailed, setWorkspaceInitFailed] = React.useState(false);
    const initAttemptedRef = React.useRef(false);

    // TODO: fix
    // const isMounted = useIsMounted();
    // const { data: remote_config_data } = useRemoteConfig(isMounted());
    let deleted_block_id: null | string = null;

    React.useEffect(() => {
        let cancelled = false;
        const startWorkspaceInit = async () => {
            if (initAttemptedRef.current) return;
            initAttemptedRef.current = true;
            setWorkspaceInitFailed(false);

            try {
                await onMount();
            } catch (error) {
                if (!cancelled) {
                    console.error('Bot builder workspace initialization failed:', error);
                    setWorkspaceInitFailed(true);
                }
            }
        };

        startWorkspaceInit();
        return () => {
            cancelled = true;
            onUnmount();
        };
    }, [onMount, onUnmount]);

    React.useEffect(() => {
        if (workspaceInitFailed) {
            const timeout = window.setTimeout(() => {
                if (window.Blockly?.derivWorkspace) {
                    setWorkspaceInitFailed(false);
                    return;
                }
                if (initAttemptedRef.current) {
                    initAttemptedRef.current = false;
                    onMount();
                }
            }, 2000);
            return () => window.clearTimeout(timeout);
        }

        const workspace = (window as any).Blockly?.derivWorkspace;
        if (workspace && is_running && !is_blockly_listener_registered.current) {
            is_blockly_listener_registered.current = true;
            workspace.addChangeListener(handleBlockChangeOnBotRun);
        } else {
            removeBlockChangeListener();
        }

        return () => {
            if (workspace && is_blockly_listener_registered.current) {
                removeBlockChangeListener();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_running]);

    const handleBlockChangeOnBotRun = (e: any) => {
        const { is_reset_button_clicked } = toolbar;
        if (e.type !== 'selected' && !is_reset_button_clicked) {
            botNotification(notification_message().workspace_change);
            removeBlockChangeListener();
        } else if (is_reset_button_clicked) {
            removeBlockChangeListener();
        }
    };

    const removeBlockChangeListener = () => {
        is_blockly_listener_registered.current = false;
        (window as any).Blockly?.derivWorkspace?.removeChangeListener(handleBlockChangeOnBotRun);
    };
    React.useEffect(() => {
        const workspace = (window as any).Blockly?.derivWorkspace;
        if (workspace && !is_blockly_delete_listener_registered.current) {
            is_blockly_delete_listener_registered.current = true;
            workspace.addChangeListener(handleBlockDelete);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_loading]);

    const handleBlockDelete = (e: any) => {
        const { is_reset_button_clicked, setResetButtonState } = toolbar;
        if (e.type === 'undo') {
            deleted_block_id = null;
            return;
        }
        if (e.type === 'delete' && !is_reset_button_clicked) {
            deleted_block_id = e.blockId;
        }
        if (e.type === 'selected' && deleted_block_id === e.oldElementId) {
            handleBlockDeleteNotification();
            deleted_block_id = null;
        }
        if (
            e.type === 'change' &&
            e.name === 'AMOUNT_LIMITS' &&
            e.newValue === '(min: 0.35 - max: 50000)' &&
            is_reset_button_clicked
        ) {
            setResetButtonState(false);
        }
    };

    const handleBlockDeleteNotification = () => {
        botNotification(notification_message().block_delete, {
            label: localize('Undo'),
            onClick: closeToast => {
                (window as any).Blockly.derivWorkspace.undo();
                closeToast?.();
            },
        });
    };

    return (
        <>
            <div
                className={classNames('bot-builder', {
                    'bot-builder--active': active_tab === DBOT_TABS.BOT_BUILDER && !is_preview_on_popup,
                    'bot-builder--inactive': is_preview_on_popup,
                    'bot-builder--tour-active': active_tour,
                })}
            >
                {workspaceInitFailed ? (
                    <div id='scratch_div' ref={el_ref} className='bot-builder__loading-state'>
                        <div className='bot-builder__loading-state-content'>
                            <p className='bot-builder__loading-state-title'>
                                {localize('Bot Builder is loading...')}
                            </p>
                            <p className='bot-builder__loading-state-description'>
                                {localize(
                                    'The workspace is taking longer than expected. Please wait a moment or refresh the page if it persists.'
                                )}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div id='scratch_div' ref={el_ref}>
                        <WorkspaceWrapper />
                    </div>
                )}
            </div>
            {active_tab === DBOT_TABS.BOT_BUILDER && <BotBuilderTourHandler is_mobile={!isDesktop} />}
            {/* removed this outside from toolbar becuase it needs to loaded seperately without dependency */}
            <LoadModal />
            <SaveModal />
            {is_open && <QuickStrategy1 />}
        </>
    );
});

export default BotBuilder;
