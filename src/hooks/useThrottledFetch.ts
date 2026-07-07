import { useCallback, useRef } from 'react';

/**
 * Throttle realtime-triggered fetches to prevent rapid duplicate requests.
 * Allows explicit calls to bypass throttle (useful for manual refresh buttons).
 *
 * @param fetchFn - The async fetch function to throttle
 * @param delayMs - Minimum milliseconds between fetch calls (default: 1000ms)
 * @returns An array: [throttledFetch, resetThrottle, lastFetchTime]
 */
export function useThrottledFetch<TArgs extends unknown[]>(
  fetchFn: (...args: TArgs) => Promise<unknown>,
  delayMs: number = 1000
): [
  throttledFetch: (...args: TArgs) => Promise<void>,
  resetThrottle: () => void,
  lastFetchTime: number
] {
  const lastFetchTimeRef = useRef<number>(0);
  const pendingRef = useRef<boolean>(false);

  const throttledFetch = useCallback(
    async (...args: TArgs) => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTimeRef.current;

      // If within throttle window and not already pending, skip
      if (timeSinceLastFetch < delayMs && pendingRef.current) {
        return;
      }

      // If within throttle window but not pending, mark as pending and defer
      if (timeSinceLastFetch < delayMs && !pendingRef.current) {
        pendingRef.current = true;
        const remainingDelay = delayMs - timeSinceLastFetch;
        setTimeout(async () => {
          pendingRef.current = false;
          try {
            await fetchFn(...args);
            lastFetchTimeRef.current = Date.now();
          } catch (error) {
            console.error('[Throttle] Deferred fetch error:', error);
          }
        }, remainingDelay);
        return;
      }

      // Execute fetch immediately if throttle window has passed
      try {
        pendingRef.current = true;
        await fetchFn(...args);
        lastFetchTimeRef.current = Date.now();
      } catch (error) {
        console.error('[Throttle] Fetch error:', error);
      } finally {
        pendingRef.current = false;
      }
    },
    [fetchFn, delayMs]
  );

  const resetThrottle = useCallback(() => {
    lastFetchTimeRef.current = 0;
    pendingRef.current = false;
  }, []);

  return [throttledFetch, resetThrottle, lastFetchTimeRef.current];
}
