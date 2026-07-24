export const dashboardRefreshIntervals = {
  superAdmin: 60_000,
  schoolAdmin: 60_000,
  teacher: 30_000,
} as const;

export const pollOnlyWhenVisible = (interval: number) => () => {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
    return false;
  }
  return interval;
};
