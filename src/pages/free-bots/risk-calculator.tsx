import React, { useEffect, useRef } from 'react';
import './risk-calculator.scss';

const RiskCalculator: React.FC = () => {
    const capitalInputRef = useRef<HTMLInputElement>(null);
    const stakeDisplayRef = useRef<HTMLSpanElement>(null);
    const takeProfitDisplayRef = useRef<HTMLSpanElement>(null);
    const stopLossDisplayRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const capitalInput = capitalInputRef.current;
        const stakeDisplay = stakeDisplayRef.current;
        const takeProfitDisplay = takeProfitDisplayRef.current;
        const stopLossDisplay = stopLossDisplayRef.current;

        if (!capitalInput || !stakeDisplay || !takeProfitDisplay || !stopLossDisplay) {
            return;
        }

        const calculateResults = () => {
            const capital = parseFloat(capitalInput.value) || 0;
            if (capital < 0) {
                capitalInput.value = '0';
                updateDisplays('0.00', '0.00', '0.00');
                return;
            }

            const initialStake = (capital * 0.02).toFixed(2);
            const takeProfit = (parseFloat(initialStake) * 5).toFixed(2);

            // Martingale stop loss: sum of stakes for 4 losses (double each time)
            let stopLoss = 0;
            let currentStake = parseFloat(initialStake);
            for (let i = 0; i < 4; i++) {
                stopLoss += currentStake;
                currentStake = currentStake * 2;
            }

            updateDisplays(initialStake, takeProfit, stopLoss.toFixed(2));
        };

        const updateDisplays = (stake: string, takeProfit: string, stopLoss: string) => {
            stakeDisplay.textContent = stake;
            takeProfitDisplay.textContent = takeProfit;
            stopLossDisplay.textContent = stopLoss;
        };

        capitalInput.addEventListener('input', calculateResults);
        capitalInput.addEventListener('touchend', calculateResults);

        // Initialize with default value
        calculateResults();

        return () => {
            capitalInput.removeEventListener('input', calculateResults);
            capitalInput.removeEventListener('touchend', calculateResults);
        };
    }, []);

    return (
        <div className='risk-calculator'>
            <div className='risk-calculator-container'>
                <h1>Martingale Calculator</h1>
                <div className='input-group'>
                    <label htmlFor='capital'>Initial Capital (₹):</label>
                    <input
                        ref={capitalInputRef}
                        type='number'
                        id='capital'
                        min='0'
                        step='0.01'
                        placeholder='Enter capital'
                        required
                    />
                </div>
                <div className='results'>
                    <div className='result-item'>
                        <span>Stake (2% of Capital):</span>
                        <span ref={stakeDisplayRef} id='stake'>
                            0.00
                        </span>
                    </div>
                    <div className='result-item'>
                        <span>Take Profit (5x Stake):</span>
                        <span ref={takeProfitDisplayRef} id='takeProfit'>
                            0.00
                        </span>
                    </div>
                    <div className='result-item'>
                        <span>Stop Loss (4 Losses Sum):</span>
                        <span ref={stopLossDisplayRef} id='stopLoss'>
                            0.00
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RiskCalculator;
