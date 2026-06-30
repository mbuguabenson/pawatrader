export const runWithTimeout = async <T>(
    task: () => Promise<T>,
    timeoutMs: number,
    onTimeout?: () => void
): Promise<T | null> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            task(),
            new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => {
                    onTimeout?.();
                    reject(new Error('Timed out'));
                }, timeoutMs);
            }),
        ]);
    } catch (error) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        return null;
    }
};
