import type { RadarStation, ScanCandidate } from "./ord";

/** These shared individual views must not inherit the reduced composite resolution. */
export function compositeRenderSize(stationId: string): number {
  return ["0-724-0-eslid", "0-724-0-essse"].includes(stationId) ? 1600 : 800;
}

export function compositeRenderKey(station: Pick<RadarStation, "id" | "lat" | "lon">, candidate: Pick<ScanCandidate, "href" | "level"> | null | undefined) {
  return ["composite-opera-scan", "detail-v2", candidate?.href ?? null, "DBZH", candidate?.level ?? null, compositeRenderSize(station.id), station.lat, station.lon] as const;
}