import { getFormattedText } from '@/components/shared';
import DBotStore from '../../../scratch/dbot-store';
import { api_base } from '../../api/api-base';
import { info } from '../utils/broadcast';

let balance_string = '';

export default Engine =>
    class Balance extends Engine {
        observeBalance() {
            if (!api_base.api) return;
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data?.msg_type === 'balance' && data?.balance) {
                    const {
                        balance: { balance: b, currency },
                    } = data;

                    balance_string = getFormattedText(b, currency);

                    if (this.accountInfo) info({ accountID: this.accountInfo.loginid, balance: balance_string });
                }
            });
            api_base.pushSubscription(subscription);
        }

        // eslint-disable-next-line class-methods-use-this
        getBalance(type) {
            const { client } = DBotStore.instance;
            // client.balance is now a computed getter that uses swapped balance
            const balance = (client && client.balance) || 0;
            // Convert string balance to number if needed
            const balanceNum = typeof balance === 'string' ? parseFloat(balance) || 0 : balance;

            balance_string = getFormattedText(balanceNum, client.currency, false);
            return type === 'STR' ? balance_string : balanceNum;
        }
    };
