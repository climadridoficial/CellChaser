// AEMET conventional weather stations: latest observation per station.

export interface AemetObs {
  idema: string;
  name: string;
  lat: number;
  lon: number;
  alt?: number | undefined;
  time: string;
  ta?: number | undefined; // air temp °C
  tamin?: number | undefined;
  tamax?: number | undefined;
  hr?: number | undefined; // humidity %
  prec?: number | undefined; // precip mm (last hour)
  vv?: number | undefined; // wind speed m/s
  vmax?: number | undefined; // gust m/s
  dv?: number | undefined; // wind dir deg
  pres?: number | undefined; // station pressure hPa
  vis?: number | undefined; // visibility km
  tpr?: number | undefined; // dew point °C
}

interface Raw {
  idema: string;
  ubi: string;
  lat: number;
  lon: number;
  alt?: number | undefined;
  fint: string;
  [k: string]: unknown;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Keep only the latest observation of each station. */
export function latestPerStation(rows: Raw[]): AemetObs[] {
  const map = new Map<string, Raw>();
  for (const r of rows) {
    const prev = map.get(r.idema);
    if (!prev || r.fint > prev.fint) map.set(r.idema, r);
  }
  return [...map.values()].map((r) => ({
    idema: r.idema,
    name: r.ubi,
    lat: r.lat,
    lon: r.lon,
    alt: n(r["alt"]),
    time: r.fint.endsWith("Z") || /[+-]\d{4}$/.test(r.fint) ? r.fint : `${r.fint}Z`,
    ta: n(r["ta"]),
    tamin: n(r["tamin"]),
    tamax: n(r["tamax"]),
    hr: n(r["hr"]),
    prec: n(r["prec"]),
    vv: n(r["vv"]),
    vmax: n(r["vmax"]),
    dv: n(r["dv"]),
    pres: n(r["pres"]),
    vis: n(r["vis"]),
    tpr: n(r["tpr"]),
  }));
}

export async function fetchAemetStations(key?: string): Promise<AemetObs[]> {
  const res = await fetch("/api/public/aemet", key ? { headers: { "x-aemet-key": key } } : {});
  const body = (await res.json().catch(() => null)) as Raw[] | { error?: string } | null;
  if (!res.ok || !Array.isArray(body)) {
    throw new Error((body as { error?: string } | null)?.error || `AEMET request failed (${res.status})`);
  }
  return latestPerStation(body);
}
