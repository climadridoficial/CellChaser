import { trackCells } from "./storm-tracking";

export const DEMO_DBZ = [32, 35, 43, 47, 54, 63, 66, 55, 44, 34];
export function demoTracks(step: number) {
  const start = Date.parse("2026-10-29T12:00:00Z");
  return trackCells(DEMO_DBZ.slice(0, step + 1).map((dbz, i) => ({
    time: start + i * 10 * 60_000,
    cells: [{ lat: 39.65 + i * 0.045, lon: -4.45 + i * 0.09, dbz, radiusKm: 5 }],
  })), "simulated-demo");
}