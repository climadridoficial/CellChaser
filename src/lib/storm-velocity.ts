import type { ScanCandidate } from './ord';

/** Recent Doppler is context, not a simultaneous measurement or storm translation. */
export const STORM_VRAD_MAX_LAG_MS = 5 * 60_000;
export function recentStormVelocity(time: number, level: number, observedAt: number, observedLevel: number): boolean {
  return Number.isFinite(time) && Number.isFinite(observedAt) && Number.isFinite(level) && Number.isFinite(observedLevel)
    && time >= observedAt && time - observedAt <= STORM_VRAD_MAX_LAG_MS && Math.abs(level - observedLevel) <= 0.01;
}
export function stormVelocityScan(candidates: ScanCandidate[], reflectivity: ScanCandidate): ScanCandidate | null {
  return candidates.filter(c => c.products?.some(p => ['VRADH', 'VRAD', 'VRADV'].includes(p))
    && recentStormVelocity(Date.parse(reflectivity.time), reflectivity.level, Date.parse(c.time), c.level))
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || a.href.localeCompare(b.href))[0] ?? null;
}