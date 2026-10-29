import { STEP_MS } from "./timeline";

/** Unknown timestamps and failed sources must never masquerade as live data. */
export function radarFrameVisible(observedAt: string | null, at: number | null, maxAgeMs: number, now: number, unavailable = false): boolean {
  if (!observedAt) return false;
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(observed)) return false;
  if (at !== null) return observed > at - STEP_MS && observed <= at + 60_000;
  return !unavailable && observed <= now + 60_000 && now - observed < maxAgeMs;
}