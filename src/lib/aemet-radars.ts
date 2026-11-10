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
  esftn: "mu", // Murcia (Fortuna), verified ORD feed
  esllm: "pm", // Illes Balears (Llucmajor), verified ORD feed
  eslid: "vd",
  esnjr: "am",
  espdg: "za",
  essft: "cc",
  essse: "ss",
  estjv: "ma",
};

/** Static locations, not live availability, from EUMETNET's OPERA inventory:
 * https://www.eumetnet.eu/wp-content/themes/aeron-child/observations-programme/current-activities/opera/database/OPERA_Database/OPERA_RADARS_DB.json
 * Keep every AEMET radar selectable when ORD discovery is unavailable.
 */
const AEMET_ONLY: { code: string; name: string; lat: number; lon: number }[] = [
  { code: "ml", name: "Málaga (Alhaurín el Grande)", lat: 36.6134, lon: -4.6593 },
  { code: "ca", name: "Gran Canaria (Artenara)", lat: 28.0189, lon: -15.6145 },
  { code: "se", name: "Sevilla (Castillo de las Guardas)", lat: 37.6887, lon: -6.3331 },
  { code: "ba", name: "Barcelona (Gelida)", lat: 41.4082, lon: 1.8849 },
  { code: "vd", name: "Palencia (Autilla del Pino)", lat: 41.9956, lon: -4.6028 },
  { code: "am", name: "Almería (Níjar)", lat: 36.8324, lon: -2.0821 },
  { code: "za", name: "Zaragoza (Perdiguera)", lat: 41.7339, lon: -0.5459 },
  { code: "cc", name: "Cáceres (Sierra de Fuentes)", lat: 39.4288, lon: -6.2853 },
  { code: "ss", name: "Vizcaya (Baquio)", lat: 43.4033, lon: -2.8419 },
  { code: "ma", name: "Madrid (Torrejón de Velasco)", lat: 40.1759, lon: -3.7136 },
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

/** Verified ORD location; catalogue failures must not erase Tenerife's marker.
 * No AEMET mapping or live availability is inferred from this location. */
export function knownOperaStations(opera: RadarStation[]): RadarStation[] {
  if (opera.some(s => s.id === '0-724-0-esbnv' || s.code === 'esbnv')) return [];
  return [{
    id: '0-724-0-esbnv', code: 'esbnv', name: 'Tenerife (Buenavista del Norte)',
    country: '724', lat: 28.3109300583601, lon: -16.823839880526066,
    parameters: [], products: [], offline: false,
  }];
}

/** Undiscovered AEMET radars as backup stations, replaced by OPERA on recovery. */
export function aemetOnlyStations(opera: RadarStation[]): RadarStation[] {
  return AEMET_ONLY.filter(
    (r) => !opera.some((s) => aemetCodeFor(s) === r.code),
  ).map((r) => {
    // A failed station catalogue is not evidence that a known OPERA radar is offline.
    const operaCode = Object.keys(OPERA_TO_AEMET).find(code => OPERA_TO_AEMET[code] === r.code);
    return {
    id: operaCode ? `0-724-0-${operaCode}` : `aemet-${r.code}`,
    code: operaCode ?? r.code,
    name: r.name,
    country: "724",
    lat: r.lat,
    lon: r.lon,
    parameters: [],
    products: [],
    aemetCode: r.code,
    offline: !operaCode,
  };
  });
}
