document.addEventListener('DOMContentLoaded', () => {
    const capitalInput = document.getElementById('capital');
    const stakeDisplay = document.getElementById('stake');
    const takeProfitDisplay = document.getElementById('takeProfit');
    const stopLossDisplay = document.getElementById('stopLoss');

    if (!capitalInput || !stakeDisplay || !takeProfitDisplay || !stopLossDisplay) {
        console.error('One or more calculator elements not found in the DOM');
        return;
    }

    capitalInput.addEventListener('input', calculateResults);
    capitalInput.addEventListener('touchend', calculateResults); // Handle touch input

    function calculateResults() {
        const capital = parseFloat(capitalInput.value) || 0;
        if (capital < 0) {
            capitalInput.value = 0;
            updateDisplays(0, 0, 0);
            return;
        }

        const initialStake = (capital * 0.02).toFixed(2);
        const takeProfit = (initialStake * 5).toFixed(2);

        // Martingale stop loss: sum of stakes for 4 losses (double each time)
        let stopLoss = 0;
        let currentStake = initialStake;
        for (let i = 0; i < 4; i++) {
            stopLoss += parseFloat(currentStake);
            currentStake = (parseFloat(currentStake) * 2).toFixed(2);
        }

        updateDisplays(initialStake, takeProfit, stopLoss.toFixed(2));
    }

    function updateDisplays(stake, takeProfit, stopLoss) {
        stakeDisplay.textContent = stake;
        takeProfitDisplay.textContent = takeProfit;
        stopLossDisplay.textContent = stopLoss;
    }

    // Initialize with default value
    calculateResults();
});
