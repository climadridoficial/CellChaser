// AEMET regional radar codes, mapped to OPERA station codes where the radar
// also publishes to OPERA. Radars missing from OPERA (e.g. under renewal) are
// listed as AEMET-only stations so they still appear on the map.

import type { RadarStation } from "./ord";

/** OPERA station code → AEMET regional radar code */
export const OPERA_TO_AEMET: Record<string, string> = {
  esahr: "ml",
  esatn: "ca", // Gran Canaria (Artenara)
  esclg: "se",
  esgld: "ba",
  eslid: "vd",
  esnjr: "am",
  espdg: "za",
  essft: "cc",
  essse: "ss",
  estjv: "ma",
};

/** AEMET radars not present in OPERA. Positions are approximate. */
const AEMET_ONLY: { code: string; name: string; lat: number; lon: number }[] = [
  { code: "co", name: "A Coruña (Cerceda)", lat: 43.17, lon: -8.53 },
  { code: "mu", name: "Murcia (Sierra de la Puerta)", lat: 38.26, lon: -1.19 },
  { code: "pm", name: "Illes Balears (Palma)", lat: 39.37, lon: 2.79 },
  { code: "sa", name: "Asturias", lat: 43.42, lon: -6.0 },
  { code: "va", name: "Valencia", lat: 39.18, lon: -0.25 },
];

export const AEMET_RADAR_CODES = new Set([...Object.values(OPERA_TO_AEMET), ...AEMET_ONLY.map((r) => r.code)]);

export function aemetCodeFor(station: RadarStation): string | null {
  return station.aemetCode ?? OPERA_TO_AEMET[station.code] ?? null;
}

/** AEMET-only radars as map stations, skipping any that reappear in OPERA. */
export function aemetOnlyStations(opera: RadarStation[]): RadarStation[] {
  return AEMET_ONLY.filter(
    (r) => !opera.some((s) => OPERA_TO_AEMET[s.code] === r.code),
  ).map((r) => ({
    id: `aemet-${r.code}`,
    code: r.code,
    name: r.name,
    country: "724",
    lat: r.lat,
    lon: r.lon,
    parameters: [],
    products: [],
    aemetCode: r.code,
    offline: true,
  }));
}
