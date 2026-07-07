import { useEffect, useRef } from 'react';

type UsePollingRefreshOptions = {
  enabled: boolean;
  intervalMs?: number;
  onRefresh: () => void | Promise<void>;
};

export function usePollingRefresh({
  enabled,
  intervalMs = 10000,
  onRefresh,
}: UsePollingRefreshOptions) {
  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void refreshRef.current();
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [enabled, intervalMs]);
}
