import React from 'react';
import { observer } from 'mobx-react-lite';
import Flyout from '@/components/flyout';
import { useStore } from '@/hooks/useStore';
import { load } from '@/external/bot-skeleton/scratch/utils';
import { save_types } from '@/external/bot-skeleton/constants/save-type';
import { NOTIFICATION_TYPE } from '@/components/bot-notification/bot-notification-utils';
import StopBotModal from '../dashboard/stop-bot-modal';
import Toolbar from './toolbar';
import Toolbox from './toolbox';
import './workspace.scss';

const WorkspaceWrapper = observer(() => {
    const { blockly_store, dashboard } = useStore();
    const { onMount, onUnmount, is_loading } = blockly_store;
    const { pending_free_bot, clearPendingFreeBot, setOpenSettings } = dashboard;

    // Track if we've already processed a pending bot to prevent duplicates
    const processedBotRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        onMount();
        return () => {
            onUnmount();
            // Reset processed bot ref on unmount
            processedBotRef.current = null;
        };
    }, []);

    // Reset processed bot ref when there's no pending bot
    React.useEffect(() => {
        if (!pending_free_bot) {
            processedBotRef.current = null;
        }
    }, [pending_free_bot]);

    // When workspace becomes available and a Free Bots handoff exists, load it once
    React.useEffect(() => {
        const maybeLoadPending = async () => {
            // Only proceed if we have a workspace, pending bot, and haven't processed this bot yet
            if (
                window.Blockly?.derivWorkspace &&
                pending_free_bot?.xml &&
                !is_loading &&
                processedBotRef.current !== pending_free_bot.name
            ) {
                // Mark this bot as being processed to prevent duplicates
                processedBotRef.current = pending_free_bot.name;

                try {
                    await load({
                        block_string: pending_free_bot.xml,
                        file_name: pending_free_bot.name,
                        workspace: window.Blockly.derivWorkspace,
                        from: save_types.LOCAL,
                        drop_event: {},
                        strategy_id: null,
                        showIncompatibleStrategyDialog: false,
                    });
                    // Show import notification and clear handoff
                    setOpenSettings?.(NOTIFICATION_TYPE.BOT_IMPORT);
                    clearPendingFreeBot();

                    // Reset the processed bot ref after successful load
                    processedBotRef.current = null;
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to load pending free bot:', e);
                    // Reset on error so user can retry
                    processedBotRef.current = null;
                }
            }
        };
        maybeLoadPending();
    }, [pending_free_bot?.name, pending_free_bot?.xml, is_loading]);

    if (is_loading) return null;

    if (window.Blockly?.derivWorkspace)
        return (
            <React.Fragment>
                <Toolbox />
                <Toolbar />
                <Flyout />
                <StopBotModal />
            </React.Fragment>
        );

    return null;
});

export default WorkspaceWrapper;
