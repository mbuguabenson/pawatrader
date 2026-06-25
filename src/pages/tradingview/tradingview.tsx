import React from 'react';
import IframeWrapper from '@/components/iframe-wrapper';

const TradingView: React.FC = () => {
    return (
        <IframeWrapper
            src='https://charts.deriv.com/deriv'
            title='TradingView Charts'
            className='tradingview-container'
        />
    );
};

export default TradingView;
