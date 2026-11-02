// Reads radar values back from rendered overlay pixels for the crosshair inspector.
import { colorFor, type ProductInfo } from "./radar-products";

const tables = new Map<string, { value: number; rgb: [number, number, number] }[]>();

function table(info: ProductInfo) {
  const key = `${info.key}:${info.scale}`;
  let t = tables.get(key);
  if (!t) {
    const [lo, hi] = [info.min, info.max];
    const n = 400;
    t = [];
    for (let i = 0; i <= n; i++) {
      const value = lo + ((hi - lo) * i) / n;
      const [r, g, b, a] = colorFor(info, value);
      if (a > 0) t.push({ value, rgb: [r, g, b] });
    }
    tables.set(key, t);
  }
  return t;
}

/** Nearest value on the product's colour scale; null when the colour doesn't belong to it. */
export function colorToValue(info: ProductInfo, r: number, g: number, b: number): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const e of table(info)) {
    const d = (e.rgb[0] - r) ** 2 + (e.rgb[1] - g) ** 2 + (e.rgb[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e.value;
    }
  }
  return bestD <= 60 ** 2 ? best : null;
}

const canvases = new WeakMap<HTMLImageElement, { src: string; ctx: CanvasRenderingContext2D }>();

/** RGBA at fractional position (0..1) of a loaded image, or null. */
export function samplePixel(img: HTMLImageElement, fx: number, fy: number): [number, number, number, number] | null {
  if (!img.complete || !img.naturalWidth || fx < 0 || fy < 0 || fx >= 1 || fy >= 1) return null;
  let entry = canvases.get(img);
  if (!entry || entry.src !== img.src) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    try {
      ctx.drawImage(img, 0, 0);
    } catch {
      return null;
    }
    entry = { src: img.src, ctx };
    canvases.set(img, entry);
  }
  try {
    const d = entry.ctx.getImageData(Math.floor(fx * img.naturalWidth), Math.floor(fy * img.naturalHeight), 1, 1).data;
    return [d[0]!, d[1]!, d[2]!, d[3]!];
  } catch {
    return null;
  }
}
