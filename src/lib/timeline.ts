// Map time slider: one shared moment for tiles, the Spain composite and the
// station panel. `null` means live (newest data).

/** All sources (OPERA, AEMET, RainViewer, LibreWXR) publish every 10 minutes. */
export const STEP_MS = 10 * 60_000;
export const HISTORY_HOURS = 3;
/** Historical positions on the slider; index STEPS is "live". */
export const STEPS = (HISTORY_HOURS * 3600_000) / STEP_MS;

export function latestSlot(now: number): number {
  return Math.floor(now / STEP_MS) * STEP_MS;
}

/** Slider index → time (null = live). */
export function slotAt(index: number, now: number): number | null {
  if (index >= STEPS) return null;
  return latestSlot(now) - (STEPS - Math.max(0, index)) * STEP_MS;
}

/** Time → slider index. */
export function slotIndex(at: number | null, now: number): number {
  if (at === null) return STEPS;
  const back = Math.round((latestSlot(now) - at) / STEP_MS);
  return Math.min(STEPS - 1, Math.max(0, STEPS - back));
}

/**
 * Newest item observed at `at` or up to `toleranceMs` before it (a minute of
 * slack after `at` absorbs scans stamped a few seconds late).
 */
export function pickFrame<T>(items: T[], time: (item: T) => number, at: number, toleranceMs = STEP_MS): T | null {
  let best: T | null = null;
  let bestTime = -Infinity;
  for (const item of items) {
    const t = time(item);
    if (t > at + 60_000 || t <= at - toleranceMs) continue;
    if (t > bestTime) {
      best = item;
      bestTime = t;
    }
  }
  return best;
}

export function formatAgo(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `hace ${h} h ${rest} min` : `hace ${h} h`;
}
