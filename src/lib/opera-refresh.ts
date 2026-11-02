/** Automatic OPERA checks run once per ten minutes, including after failures. */
export const OPERA_REFRESH_MS = 10 * 60_000;
export const OPERA_POLL_OPTIONS = {
  staleTime: OPERA_REFRESH_MS,
  refetchInterval: OPERA_REFRESH_MS,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const;