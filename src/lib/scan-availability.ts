import { pickScan, type ScanCandidate } from "./ord";
import { radarFrameVisible } from "./radar-freshness";

/** Keep the exact composite render until the user explicitly changes the scan. */
export function sharedIndividualScan<T extends { time: string }>(stationId: string, scan: T | null, manual: boolean, at: number | null, maxAge: number, now: number): T | null {
  return ["0-724-0-eslid", "0-724-0-essse"].includes(stationId) && !manual && scan && radarFrameVisible(scan.time, at, maxAge, now) ? scan : null;
}

export function scanRange(candidate: ScanCandidate): "short" | "long" {
  // The two AEMET scan modes are ~120–150 km and ~240–250 km.
  return candidate.rangeKm !== undefined ? (candidate.rangeKm >= 200 ? "long" : "short") : candidate.doppler ? "short" : "long";
}

/** Opening a radar uses the composite's volume policy, without suppressing weak echoes. */
export function initialRadarSelection(candidates: ScanCandidate[], product: string, at: number | null, maxAge: number, now: number) {
  const visible = candidates.filter(c => c.products?.includes(product) && radarFrameVisible(c.time, at, maxAge, now));
  const scan = pickScan(visible, at ?? now, maxAge);
  return scan ? { level: scan.level, range: scanRange(scan) } : null;
}

/** Known station capability remains selectable when the latest catalogue is incomplete. */
export function individualRangeOptions(stationId: string, candidates: ScanCandidate[], product: string | null): ("short" | "long")[] {
  const knownDualRange = ["0-724-0-essse", "0-724-0-eslid"].includes(stationId)
    && ["DBZH", "DBZV", "TH", "TV"].includes(product ?? "");
  const matching = candidates.filter(c => c.products?.includes(product ?? ""));
  return (["short", "long"] as const).filter(range => knownDualRange || matching.some(c => scanRange(c) === range));
}

export function selectionCandidates(candidates: ScanCandidate[], product: string | null, range: "short" | "long", strictRange = false) {
  const matching = candidates.filter((c) => c.products?.includes(product ?? ""));
  const both = matching.some((c) => scanRange(c) === "short") && matching.some((c) => scanRange(c) === "long");
  return both || strictRange ? matching.filter((c) => scanRange(c) === range) : matching;
}

export function usableLevels(candidates: ScanCandidate[], at: number | null, maxAge: number, now: number) {
  return [...new Set(candidates.filter((c) => radarFrameVisible(c.time, at, maxAge, now)).map((c) => c.level))].sort((a, b) => a - b);
}

/** Missing one angle/product is not a station-wide outage. */
export function stationHasScans(candidates: ScanCandidate[], at: number | null, maxAge: number, now: number) {
  return candidates.some((c) => radarFrameVisible(c.time, at, maxAge, now));
}

/** Only measured velocity at the reflectivity observation's exact time/tilt is evidence. */
export function matchingVelocityScan(candidates: ScanCandidate[], reflectivity: ScanCandidate) {
  return candidates.find(c => c.doppler && Date.parse(c.time) === Date.parse(reflectivity.time)
    && Math.abs(c.level - reflectivity.level) <= 0.01
    && c.products?.some(p => ['VRADH', 'VRAD', 'VRADV'].includes(p))) ?? null;
}