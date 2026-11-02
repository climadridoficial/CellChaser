import { pickScan, type ScanCandidate } from "./ord";
import { radarFrameVisible } from "./radar-freshness";

/** Opening a radar uses the composite's volume policy, without suppressing weak echoes. */
export function initialRadarSelection(candidates: ScanCandidate[], product: string, at: number | null, maxAge: number, now: number) {
  const visible = candidates.filter(c => c.products?.includes(product) && radarFrameVisible(c.time, at, maxAge, now));
  const scan = pickScan(visible, at ?? now, maxAge);
  return scan ? { level: scan.level, range: scan.doppler ? "short" as const : "long" as const } : null;
}

/** Known station capability remains selectable when the latest catalogue is incomplete. */
export function individualRangeOptions(stationId: string, candidates: ScanCandidate[], product: string | null): ("short" | "long")[] {
  const knownDualRange = ["0-724-0-essse", "0-724-0-eslid"].includes(stationId)
    && ["DBZH", "DBZV", "TH", "TV"].includes(product ?? "");
  const matching = candidates.filter(c => c.products?.includes(product ?? ""));
  return (["short", "long"] as const).filter(range => knownDualRange || matching.some(c => c.doppler === (range === "short")));
}

export function selectionCandidates(candidates: ScanCandidate[], product: string | null, range: "short" | "long", strictRange = false) {
  const matching = candidates.filter((c) => c.products?.includes(product ?? ""));
  const both = matching.some((c) => c.doppler) && matching.some((c) => !c.doppler);
  return both || strictRange ? matching.filter((c) => c.doppler === (range === "short")) : matching;
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