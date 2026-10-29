// ODIM/HDF5 polar volume decoding + rendering to an image overlay.
// Runs in the browser only (dynamic jsfive import), never during SSR.

import { colorFor, productInfo, type ProductInfo } from "./radar-products";
import { rangeStartMetres, mercatorY, latitudeFromY, polarAt, rayLookup } from "./radar-geometry";
import type { EchoGrid } from "./storm-tracking";

export interface RenderedScan {
  dataUrl: string;
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
  product: string;
  info: ProductInfo;
  elangle: number;
  rangeKm: number;
  time: string;
  station: { lat: number; lon: number };
  min: number;
  max: number;
  echoGrid?: EchoGrid;
}

interface H5Group {
  keys: string[];
  attrs: Record<string, unknown>;
  get(path: string): H5Group | H5Dataset | null;
}
interface H5Dataset {
  shape: number[];
  value: ArrayLike<number>;
  attrs: Record<string, unknown>;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.replace(/\0+$/, "").trim() : String(v ?? "");
}
function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : fallback;
}

export function proxiedFileUrl(href: string): string {
  return `/api/public/odim?url=${encodeURIComponent(href)}`;
}

export async function decodeAndRender(opts: {
  href: string;
  product: string;
  level: number;
  time: string;
  fallbackStation: { lat: number; lon: number };
  /** Fixed canvas size; defaults to full range-gate detail. */
  size?: number;
}): Promise<RenderedScan> {
  const res = await fetch(proxiedFileUrl(opts.href));
  if (!res.ok) throw new Error(`Could not download the radar scan (${res.status})`);
  const buffer = await res.arrayBuffer();

  const { File: H5File } = (await import("jsfive")) as unknown as {
    File: new (b: ArrayBuffer, n?: string) => H5Group;
  };
  const file = new H5File(buffer, "scan.h5");

  const rootWhere = file.get("where") as H5Group | null;
  const lat = num(rootWhere?.attrs["lat"], opts.fallbackStation.lat);
  const lon = num(rootWhere?.attrs["lon"], opts.fallbackStation.lon);

  // Find the dataset (elevation) + data group (quantity) that match the request.
  let best: { data: H5Dataset; where: H5Group; what: H5Group; how: H5Group | null; elangle: number } | null = null;
  for (const dsKey of file.keys.filter((k) => /^dataset\d+$/.test(k))) {
    const ds = file.get(dsKey) as H5Group | null;
    if (!ds) continue;
    const where = ds.get("where") as H5Group | null;
    const elangle = num(where?.attrs["elangle"], NaN);
    for (const dKey of ds.keys.filter((k) => /^data\d+$/.test(k))) {
      const dg = ds.get(dKey) as H5Group | null;
      if (!dg) continue;
      const what = dg.get("what") as H5Group | null;
      if (!where || !what) continue;
      if (str(what?.attrs["quantity"]) !== opts.product) continue;
      const arr = dg.get("data") as H5Dataset | null;
      if (!arr || arr.shape.length !== 2) continue;
      const candidate = { data: arr, where, what, how: ds.get("how") as H5Group | null, elangle };
      if (
        !best ||
        Math.abs(elangle - opts.level) < Math.abs(best.elangle - opts.level)
      ) {
        best = candidate;
      }
    }
  }

  if (!best) throw new Error(`${opts.product} is not present inside this scan file.`);

  const gain = num(best.what.attrs["gain"], 1) || 1;
  const offset = num(best.what.attrs["offset"], 0);
  const nodata = num(best.what.attrs["nodata"], NaN);
  const undetect = num(best.what.attrs["undetect"], NaN);
  const nrays = best.data.shape[0];
  const nbins = best.data.shape[1];
  if (!nrays || !nbins) throw new Error("Radar scan has no range gates.");
  const rscale = num(best.where.attrs["rscale"], 1000) || 1000;
  const rstart = rangeStartMetres(num(best.where.attrs["rstart"], 0), str(file.attrs["Conventions"]));
  const rangeM = rstart + nbins * rscale;

  const info = productInfo(opts.product);
  // One canvas pixel per half range gate (capped) keeps native bin detail.
  const size = opts.size ?? Math.min(2400, Math.max(1200, nbins * 2));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create radar image.");
  const image = ctx.createImageData(size, size);
  const px = image.data;
  const values = best.data.value;
  const gridSize = Math.min(size, 240);
  const echoValues = info.scale === "reflectivity" ? new Float32Array(gridSize * gridSize).fill(NaN) : null;

  let vMin = Infinity;
  let vMax = -Infinity;
  const radians = Math.PI / 180;
  const earth = 6378137;
  const angularRange = rangeM / earth;
  const south = lat - angularRange / radians;
  const north = lat + angularRange / radians;
  const dLon = Math.asin(Math.min(1, Math.sin(angularRange) / Math.cos(lat * radians))) / radians;
  const west = lon - dLon;
  const east = lon + dLon;
  const topY = mercatorY(north);
  const bottomY = mercatorY(south);
  const rays = rayLookup(nrays, best.how?.attrs["startazA"] as ArrayLike<number> | undefined, best.how?.attrs["stopazA"] as ArrayLike<number> | undefined);
  // Effective-Earth beam model: convert ground arc to slant range at this tilt.
  const effectiveEarth = earth * 4 / 3;
  const tilt = best.elangle * radians;

  for (let y = 0; y < size; y++) {
    const pixelLat = latitudeFromY(topY - (y + 0.5) / size * (topY - bottomY));
    for (let x = 0; x < size; x++) {
      const pixelLon = west + (x + 0.5) / size * (east - west);
      const { distance, bearing } = polarAt(pixelLat, pixelLon, lat, lon);
      const arc = distance / effectiveEarth;
      const range = effectiveEarth * Math.sin(arc) / Math.cos(tilt + arc);
      if (range > rangeM || range < rstart) continue;
      const ray = rays[Math.floor(bearing * 10)];
      if (ray === undefined || ray < 0) continue;
      const bin = Math.min(nbins - 1, Math.floor((range - rstart) / rscale));
      const raw = values[ray * nbins + bin];
      if (raw === undefined) continue;
      if (raw === nodata || raw === undetect) continue;
      // Velocity: raw 0 is the conventional "no echo" code even if undetect isn't declared.
      if (info.scale === "velocity" && raw === 0) continue;
      const value = raw * gain + offset;
      if (!Number.isFinite(value)) continue;
      if (echoValues) {
        const gi = Math.floor(y / size * gridSize) * gridSize + Math.floor(x / size * gridSize);
        if (!Number.isFinite(echoValues[gi]) || value > Number(echoValues[gi])) echoValues[gi] = value;
      }
      if (value < vMin) vMin = value;
      if (value > vMax) vMax = value;
      const [r, g, b, a] = colorFor(info, value);
      if (a === 0) continue;
      const idx = (y * size + x) * 4;
      px[idx] = r;
      px[idx + 1] = g;
      px[idx + 2] = b;
      px[idx + 3] = a;
    }
  }
  ctx.putImageData(image, 0, 0);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    echoGrid: echoValues ? { values: echoValues, width: gridSize, height: gridSize, bounds: [[south, west], [north, east]] } : undefined,
    bounds: [
      [south, west],
      [north, east],
    ],
    product: opts.product,
    info,
    elangle: Math.round(best.elangle * 100) / 100,
    rangeKm: Math.round(rangeM / 1000),
    time: opts.time,
    station: { lat, lon },
    min: Number.isFinite(vMin) ? Math.round(vMin * 10) / 10 : 0,
    max: Number.isFinite(vMax) ? Math.round(vMax * 10) / 10 : 0,
  };
}
