import { runWithTimeout } from '../bootstrap';

describe('runWithTimeout', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('resolves to null and notifies when a startup step exceeds the timeout', async () => {
        const onTimeout = jest.fn();
        const pending = runWithTimeout(() => new Promise(() => undefined), 10, onTimeout);

        jest.advanceTimersByTime(10);

        await expect(pending).resolves.toBeNull();
        expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('resolves with the original result when the startup step finishes first', async () => {
        const result = await runWithTimeout(async () => 'ready', 50);

        expect(result).toBe('ready');
    });
});
