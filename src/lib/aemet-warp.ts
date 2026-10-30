import type { Corners, RadarBounds } from "./aemet-overlay";

const rad = Math.PI / 180;
const mx = (lon: number) => lon * rad;
const my = (lat: number) => -Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2));

/** Projective map from image fraction (s,t) to Mercator quad [TL,TR,BR,BL]. Returns its inverse. */
function inverseHomography(q: [number, number][]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q as [[number, number], [number, number], [number, number], [number, number]];
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let a, b, d, e, g = 0, k = 0;
  if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) {
    a = x1 - x0; b = x3 - x0; d = y1 - y0; e = y3 - y0;
  } else {
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    k = (dx1 * sy - sx * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + k * x3; d = y1 - y0 + g * y1; e = y3 - y0 + k * y3;
  }
  // M = [[a,b,x0],[d,e,y0],[g,k,1]]; invert.
  const A = e - y0 * k, B = -(d - y0 * g), C = d * k - e * g;
  const det = a * A + b * B + x0 * C;
  const inv = [
    A, -(b - x0 * k), b * y0 - x0 * e,
    B, a - x0 * g, -(a * y0 - x0 * d),
    C, -(a * k - b * g), a * e - b * d,
  ].map(v => v / det) as number[];
  return (x: number, y: number): [number, number] => {
    const w = inv[6]! * x + inv[7]! * y + inv[8]!;
    return [(inv[0]! * x + inv[1]! * y + inv[2]!) / w, (inv[3]! * x + inv[4]! * y + inv[5]!) / w];
  };
}

export interface WarpPlan { width: number; height: number; bounds: RadarBounds; source: Int32Array }

/**
 * Resamples a srcW×srcH image placed on free corners into an axis-aligned
 * Mercator box (nearest neighbour, no new colours). `source[i]` is the source
 * pixel index for output pixel i, or -1 outside the quad. Outline maps are
 * applied in source pixels first, so rotation/stretch never shifts them.
 */
export function warpPlan(corners: Corners, srcW: number, srcH: number): WarpPlan {
  const lats = corners.map(p => p[0]), lons = corners.map(p => p[1]);
  const south = Math.min(...lats), north = Math.max(...lats), west = Math.min(...lons), east = Math.max(...lons);
  const X0 = mx(west), X1 = mx(east), Y0 = my(north), Y1 = my(south);
  const scale = Math.max(srcW, srcH) * 1.1 / Math.max(X1 - X0, Y1 - Y0);
  const width = Math.max(1, Math.round((X1 - X0) * scale)), height = Math.max(1, Math.round((Y1 - Y0) * scale));
  const toUV = inverseHomography(corners.map(([lat, lon]) => [mx(lon), my(lat)]));
  const source = new Int32Array(width * height).fill(-1);
  for (let j = 0; j < height; j++) {
    const Y = Y0 + ((j + 0.5) / height) * (Y1 - Y0);
    for (let i = 0; i < width; i++) {
      const [s, t] = toUV(X0 + ((i + 0.5) / width) * (X1 - X0), Y);
      if (s < 0 || s >= 1 || t < 0 || t >= 1) continue;
      source[j * width + i] = Math.floor(t * srcH) * srcW + Math.floor(s * srcW);
    }
  }
  return { width, height, bounds: [[south, west], [north, east]], source };
}

export function warpRgba(plan: WarpPlan, rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(new ArrayBuffer(plan.width * plan.height * 4));
  plan.source.forEach((s, i) => { if (s >= 0) out.set(rgba.subarray(s * 4, s * 4 + 4), i * 4); });
  return out;
}

export function warpValues(plan: WarpPlan, values: Float32Array): Float32Array {
  const out = new Float32Array(plan.width * plan.height).fill(NaN);
  plan.source.forEach((s, i) => { if (s >= 0) out[i] = values[s]!; });
  return out;
}

const plans = new Map<string, WarpPlan>();
export function cachedPlan(code: string, corners: Corners, w: number, h: number): WarpPlan {
  let p = plans.get(code);
  if (!p) { p = warpPlan(corners, w, h); plans.set(code, p); }
  return p;
}
