// EUMETNET OPERA / OpenRadarData (ORD) EDR API client — browser safe.
// The API allows anonymous, rate-limited access and sends permissive CORS
// headers, so it is queried directly from the browser. Only the ODIM/HDF5
// binaries (hosted on an S3 bucket without CORS) go through our proxy route.

export const ORD_BASE = "https://api.meteogate.eu/eu-eumetnet-weather-radar";
const COLLECTION = `${ORD_BASE}/collections/observations`;

export interface RadarStation {
  id: string; // WIGOS id, e.g. 0-724-0-esahr
  code: string; // esahr
  name: string;
  country: string; // ISO numeric country part of the WIGOS id
  lat: number;
  lon: number;
  /** e.g. ["DBZH:scan", "TH:scan"] */
  parameters: string[];
  products: string[]; // unique ODIM quantities
  /** AEMET regional radar code for backup imagery */
  aemetCode?: string;
  /** Not transmitting to OPERA — AEMET backup only */
  offline?: boolean;
}

export interface ScanEntry {
  product: string;
  parameterName: string;
  level: number;
  period: string | null;
  nbins: number | null;
  rscale: number | null;
}

export interface ScanFile {
  href: string;
  time: string; // ISO
  bytes: number | null;
}

function authHeaders(apiKey?: string): HeadersInit {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

async function getJson<T>(url: string, apiKey?: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json", ...authHeaders(apiKey) } });
  if (!res.ok) {
    throw new Error(
      res.status === 429
        ? "OPERA rate limit reached — add a Meteogate API key in settings or retry shortly."
        : `OPERA request failed (${res.status})`,
    );
  }
  return (await res.json()) as T;
}

interface LocationFeature {
  id: string;
  geometry: { coordinates: number[] };
  properties: { name: string; "parameter-name"?: string[] };
}

export async function fetchStations(apiKey?: string): Promise<RadarStation[]> {
  const data = await getJson<{ features: LocationFeature[] }>(`${COLLECTION}/locations`, apiKey);
  return data.features
    .filter((f) => /^0-\d+-\d+-/.test(f.id))
    .map((f) => {
      const parts = f.id.split("-");
      const parameters = f.properties["parameter-name"] ?? [];
      const rawName = f.properties.name ?? f.id;
      const match = /^\[(.+?)\]\s*(.*)$/.exec(rawName);
      return {
        id: f.id,
        code: match?.[1] ?? parts.slice(3).join("-"),
        name: (match?.[2] || rawName).trim(),
        country: parts[1] ?? "",
        lon: f.geometry.coordinates[0] ?? 0,
        lat: f.geometry.coordinates[1] ?? 0,
        parameters,
        products: [...new Set(parameters.map((p) => p.split(":")[0]!))].sort(),
      };
    })
    .filter((s) => s.products.length > 0);
}

interface ItemFeature {
  properties: {
    standard_name: string;
    parameter_name: string;
    level: number;
    period?: string;
    radar_meta?: { nbins?: number; rscale?: number };
  };
}

/** Product + elevation availability for one station (from the items endpoint). */
export async function fetchStationScans(platform: string, apiKey?: string): Promise<ScanEntry[]> {
  const data = await getJson<{ features: ItemFeature[] }>(
    `${COLLECTION}/items?platform=${encodeURIComponent(platform)}&limit=500`,
    apiKey,
  );
  const seen = new Map<string, ScanEntry>();
  for (const f of data.features ?? []) {
    const p = f.properties;
    const key = `${p.standard_name}@${p.level}`;
    if (!seen.has(key)) {
      seen.set(key, {
        product: p.standard_name,
        parameterName: p.parameter_name,
        level: p.level,
        period: p.period ?? null,
        nbins: p.radar_meta?.nbins ?? null,
        rscale: p.radar_meta?.rscale ?? null,
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.product.localeCompare(b.product) || a.level - b.level);
}

const FILE_TIME = /@(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})@/;

/**
 * Available ODIM files for a station / product / elevation, newest first.
 * `hours` selects the datetime range (the archive keeps the last 24h).
 */
export async function fetchScanFiles(
  opts: { platform: string; parameterName: string; level: number; hours: number },
  apiKey?: string,
): Promise<ScanFile[]> {
  const end = new Date();
  const start = new Date(end.getTime() - opts.hours * 3600_000);
  const url =
    `${COLLECTION}/locations/${encodeURIComponent(opts.platform)}` +
    `?level=${opts.level}&format=ODIM` +
    `&datetime=${start.toISOString().replace(/\.\d+Z$/, "Z")}/${end.toISOString().replace(/\.\d+Z$/, "Z")}`;

  const data = await getJson<{
    coverages?: { parameters?: Record<string, unknown>; links?: { href: string; type?: string; length?: number }[] }[];
  }>(url, apiKey);

  const files: ScanFile[] = [];
  for (const cov of data.coverages ?? []) {
    // Some ORD parameter-filtered queries return empty despite publishing the
    // quantity in multi-product volumes. Discover volumes and filter locally.
    if (!cov.parameters || !(opts.parameterName in cov.parameters)) continue;
    for (const link of cov.links ?? []) {
      if (link.type !== "application/x-odim") continue;
      const m = FILE_TIME.exec(link.href);
      if (!m) continue;
      files.push({
        href: link.href,
        time: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`,
        bytes: link.length ?? null,
      });
    }
  }
  files.sort((a, b) => b.time.localeCompare(a.time));
  return [...new Map(files.map((f) => [f.href, f])).values()];
}

/** Spain + Portugal: the default coverage area. */
export const IBERIA = ["724", "620"];

export const COUNTRIES: { code: string; label: string }[] = [
  { code: "724", label: "Spain (AEMET)" },
  { code: "620", label: "Portugal" },
  { code: "250", label: "France" },
  { code: "276", label: "Germany" },
  { code: "380", label: "Italy" },
  { code: "528", label: "Netherlands" },
  { code: "056", label: "Belgium" },
  { code: "756", label: "Switzerland" },
  { code: "040", label: "Austria" },
  { code: "208", label: "Denmark" },
  { code: "246", label: "Finland" },
  { code: "578", label: "Norway" },
  { code: "752", label: "Sweden" },
  { code: "191", label: "Croatia" },
  { code: "203", label: "Czechia" },
  { code: "233", label: "Estonia" },
  { code: "352", label: "Iceland" },
  { code: "372", label: "Ireland" },
  { code: "440", label: "Lithuania" },
  { code: "470", label: "Malta" },
  { code: "616", label: "Poland" },
  { code: "705", label: "Slovenia" },
  { code: "642", label: "Romania" },
];

export function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.code === code || c.code === code.padStart(3, "0"))?.label ?? `Country ${code}`;
}

export interface ScanCandidate {
  href: string;
  time: string; // ISO
  level: number;
  doppler: boolean;
}

/** Every ODIM file publishing `product` in the last `hours` (one request). */
export async function fetchScanHistory(
  platform: string,
  product: string,
  hours: number,
  apiKey?: string,
): Promise<ScanCandidate[]> {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600_000);
  const iso = (d: Date) => d.toISOString().replace(/\.\d+Z$/, "Z");
  const data = await getJson<{
    coverages?: {
      parameters?: Record<string, unknown>;
      domain?: { axes?: { z?: { values?: number[] } } };
      links?: { href: string; type?: string }[];
    }[];
  }>(
    `${COLLECTION}/locations/${encodeURIComponent(platform)}?format=ODIM&datetime=${iso(start)}/${iso(end)}`,
    apiKey,
  );
  const out = new Map<string, ScanCandidate>();
  for (const cov of data.coverages ?? []) {
    const params = Object.keys(cov.parameters ?? {});
    if (!params.some((p) => p.split(":")[0] === product)) continue;
    const level = cov.domain?.axes?.z?.values?.[0];
    if (typeof level !== "number") continue;
    const doppler = params.some((p) => p.startsWith("VRAD"));
    for (const link of cov.links ?? []) {
      if (link.type !== "application/x-odim") continue;
      const m = FILE_TIME.exec(link.href);
      if (!m) continue;
      const time = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`;
      out.set(link.href, { href: link.href, time, level, doppler });
    }
  }
  return [...out.values()];
}

/**
 * Best scan observed in (at − windowMs, at + 1 min]: lowest elevation first,
 * reflectivity-only (long range) volumes over Doppler ones, then newest.
 */
export function pickScan(candidates: ScanCandidate[], at: number, windowMs: number): ScanCandidate | null {
  let best: ScanCandidate | null = null;
  for (const c of candidates) {
    const t = Date.parse(c.time);
    if (t > at + 60_000 || t <= at - windowMs) continue;
    const better =
      !best ||
      c.level < best.level ||
      (c.level === best.level && best.doppler && !c.doppler) ||
      (c.level === best.level && best.doppler === c.doppler && c.time > best.time);
    if (better) best = c;
  }
  return best;
}

/** Newest scan of `product` at the station's lowest elevation, in one request. */
export async function fetchLatestScan(
  platform: string,
  product: string,
  maxAgeMs: number,
  apiKey?: string,
): Promise<{ href: string; time: string; level: number } | null> {
  const all = await fetchScanHistory(platform, product, maxAgeMs / 3600_000, apiKey);
  const best = pickScan(all, Date.now(), maxAgeMs);
  return best ? { href: best.href, time: best.time, level: best.level } : null;
}
