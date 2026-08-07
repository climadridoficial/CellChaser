// ODIM/HDF5 polar volume decoding + rendering to an image overlay.
// Runs in the browser only (dynamic jsfive import), never during SSR.

import { colorFor, productInfo, type ProductInfo } from "./radar-products";

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
  let best: { data: H5Dataset; where: H5Group; what: H5Group; elangle: number } | null = null;
  for (const dsKey of file.keys.filter((k) => /^dataset\d+$/.test(k))) {
    const ds = file.get(dsKey) as H5Group | null;
    if (!ds) continue;
    const where = ds.get("where") as H5Group | null;
    const elangle = num(where?.attrs["elangle"], NaN);
    for (const dKey of ds.keys.filter((k) => /^data\d+$/.test(k))) {
      const dg = ds.get(dKey) as H5Group | null;
      if (!dg) continue;
      const what = dg.get("what") as H5Group | null;
      if (str(what?.attrs["quantity"]) !== opts.product) continue;
      const arr = dg.get("data") as H5Dataset | null;
      if (!arr || arr.shape.length !== 2) continue;
      const candidate = { data: arr, where: where!, what: what!, elangle };
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
  const nrays = best.data.shape[0]!;
  const nbins = best.data.shape[1]!;
  const rscale = num(best.where.attrs["rscale"], 1000) || 1000;
  const rstart = num(best.where.attrs["rstart"], 0) * 1000;
  const rangeM = rstart + nbins * rscale;

  const info = productInfo(opts.product);
  const size = 720;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  const px = image.data;
  const values = best.data.value;

  let vMin = Infinity;
  let vMax = -Infinity;
  const half = size / 2;
  const metersPerPixel = rangeM / half;

  for (let y = 0; y < size; y++) {
    const dy = (half - y - 0.5) * metersPerPixel; // north positive
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) * metersPerPixel;
      const range = Math.hypot(dx, dy);
      if (range > rangeM || range < rstart) continue;
      let azimuth = (Math.atan2(dx, dy) * 180) / Math.PI;
      if (azimuth < 0) azimuth += 360;
      const ray = Math.min(nrays - 1, Math.floor((azimuth / 360) * nrays));
      const bin = Math.min(nbins - 1, Math.floor((range - rstart) / rscale));
      const raw = values[ray * nbins + bin];
      if (raw === undefined) continue;
      if (raw === nodata || raw === undetect) continue;
      const value = raw * gain + offset;
      if (value === nodata || !Number.isFinite(value)) continue;
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

  const dLat = rangeM / 111_320;
  const dLon = rangeM / (111_320 * Math.cos((lat * Math.PI) / 180));

  return {
    dataUrl: canvas.toDataURL("image/png"),
    bounds: [
      [lat - dLat, lon - dLon],
      [lat + dLat, lon + dLon],
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
