import type { ScanCandidate } from "./ord";
import { radarFrameVisible } from "./radar-freshness";

export function selectionCandidates(candidates: ScanCandidate[], product: string | null, range: "short" | "long") {
  const matching = candidates.filter((c) => c.products?.includes(product ?? ""));
  const both = matching.some((c) => c.doppler) && matching.some((c) => !c.doppler);
  return both ? matching.filter((c) => c.doppler === (range === "short")) : matching;
}

export function usableLevels(candidates: ScanCandidate[], at: number | null, maxAge: number, now: number) {
  return [...new Set(candidates.filter((c) => radarFrameVisible(c.time, at, maxAge, now)).map((c) => c.level))].sort((a, b) => a - b);
}

/** Missing one angle/product is not a station-wide outage. */
export function stationHasScans(candidates: ScanCandidate[], at: number | null, maxAge: number, now: number) {
  return candidates.some((c) => radarFrameVisible(c.time, at, maxAge, now));
}