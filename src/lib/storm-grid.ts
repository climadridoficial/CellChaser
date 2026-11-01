import { rangeStartMetres, mercatorY, latitudeFromY, polarAt, rayLookup } from "./radar-geometry";
import type { EchoGrid } from "./storm-tracking";

interface Group { keys: string[]; attrs: Record<string, unknown>; get(path: string): Group | Dataset | null }
interface Dataset { shape: number[]; value: ArrayLike<number>; attrs: Record<string, unknown> }
const num = (v: unknown, fallback = 0) => { const n = Number(Array.isArray(v) ? v[0] : v); return Number.isFinite(n) ? n : fallback; };
const str = (v: unknown) => String(v ?? "").replace(/\0+$/, "").trim();

export function calibratedGate(raw: number|undefined, gain: number, offset: number, nodata: number, undetect: number): number {
  if(raw===undefined || !Number.isFinite(raw) || raw===nodata || raw===undetect || !Number.isFinite(gain) || !Number.isFinite(offset)) return NaN;
  return raw*gain+offset;
}

/** Canonical numeric raster, independent of each device's image render size. */
export async function operaStormGrid(buffer: ArrayBuffer, level: number, fallback: {lat:number;lon:number}, quantities: readonly string[] = ['DBZH'], exactLevel = false): Promise<EchoGrid> {
  const { File } = await import("jsfive") as unknown as { File: new (buffer: ArrayBuffer, name: string) => Group };
  const file = new File(buffer, "storm.h5");
  const root = file.get("where") as Group | null;
  const lat = num(root?.attrs["lat"], fallback.lat), lon = num(root?.attrs["lon"], fallback.lon);
  let best: { data: Dataset; where: Group; what: Group; how: Group | null; tilt: number } | null = null;
  for (const key of file.keys.filter(k => /^dataset\d+$/.test(k))) {
    const ds = file.get(key) as Group | null;
    if (!ds) continue;
    const where = ds.get("where") as Group | null;
    if (!where) continue;
    const tilt = num(where.attrs["elangle"], NaN);
    for (const key of ds.keys.filter(k => /^data\d+$/.test(k))) {
      const dg = ds.get(key) as Group | null, what = dg?.get("what") as Group | null;
      const data = dg?.get("data") as Dataset | null;
      if (!what || !data || !quantities.includes(str(what.attrs["quantity"])) || data.shape.length !== 2 || !Number.isFinite(tilt) || (exactLevel && Math.abs(tilt-level)>0.01)) continue;
      if (!best || Math.abs(tilt - level) < Math.abs(best.tilt - level)) best = {data,where,what,how:ds.get("how") as Group|null,tilt};
    }
  }
  if (!best) throw new Error(`No ${quantities.join('/')} data at requested elevation`);
  const nrays = best.data.shape[0], nbins = best.data.shape[1];
  if (!nrays || !nbins) throw new Error("Empty scan");
  const raw = best.data.value, gain = num(best.what.attrs["gain"],1), offset = num(best.what.attrs["offset"]);
  if (quantities.some(q=>q.startsWith('VRAD')) && (!Number.isFinite(num(best.what.attrs['gain'],NaN)) || !Number.isFinite(num(best.what.attrs['offset'],NaN)))) throw new Error('Missing velocity calibration');
  const nodata = num(best.what.attrs["nodata"],NaN), undetect = num(best.what.attrs["undetect"],NaN);
  const rscale = num(best.where.attrs["rscale"],1000), rstart = rangeStartMetres(num(best.where.attrs["rstart"]),str(file.attrs["Conventions"]));
  const rangeM = rstart + nbins*rscale, rad = Math.PI/180, earth = 6378137;
  const south = lat-rangeM/earth/rad, north = lat+rangeM/earth/rad;
  const dlon = Math.asin(Math.min(1,Math.sin(rangeM/earth)/Math.cos(lat*rad)))/rad;
  const west = lon-dlon, east = lon+dlon, top = mercatorY(north), bottom = mercatorY(south);
  const rays = rayLookup(nrays,best.how?.attrs["startazA"] as ArrayLike<number>|undefined,best.how?.attrs["stopazA"] as ArrayLike<number>|undefined);
  const width = 480, height = 480, values = new Float32Array(width*height).fill(NaN), effective = earth*4/3;
  for (let y=0;y<height;y++) {
    const plat = latitudeFromY(top-(y+0.5)/height*(top-bottom));
    for (let x=0;x<width;x++) {
      const {distance,bearing} = polarAt(plat,west+(x+0.5)/width*(east-west),lat,lon);
      const arc = distance/effective, range = effective*Math.sin(arc)/Math.cos(best.tilt*rad+arc);
      if (range<rstart || range>=rangeM) continue;
      const ray = rays[Math.floor(bearing*10)];
      if (ray===undefined || ray<0) continue;
      const value = raw[ray*nbins+Math.floor((range-rstart)/rscale)];
      values[y*width+x]=calibratedGate(value,gain,offset,nodata,undetect);
    }
  }
  return {values,width,height,bounds:[[south,west],[north,east]]};
}