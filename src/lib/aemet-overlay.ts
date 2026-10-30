export const AEMET_REFRESH_MS = 10 * 60_000;
export type RadarBounds = [[number, number], [number, number]];
export interface AemetMapImage {
  code: string;
  image: string;
  bounds: RadarBounds;
  editing: boolean;
  opacity: number;
  /** Free quadrilateral [NW, NE, SE, SW] as [lat, lon]; overrides bounds when set. */
  corners?: Corners;
}
export type LatLon = [number, number];
export type Corners = [LatLon, LatLon, LatLon, LatLon];

export function cornersFromBounds([[s, w], [n, e]]: RadarBounds): Corners {
  return [[n, w], [n, e], [s, e], [s, w]];
}
export function boundsOfCorners(c: Corners): RadarBounds {
  const lats = c.map(p => p[0]), lons = c.map(p => p[1]);
  return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
}
export function validCorners(c: unknown): c is Corners {
  return Array.isArray(c) && c.length === 4 && c.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 85 && Math.abs(p[1]) <= 180);
}

/** CSS matrix3d mapping a w×h image (origin top-left) onto pixel quad [TL, TR, BR, BL]. */
export function quadMatrix(w: number, h: number, q: [number, number][]): number[] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q as [[number, number], [number, number], [number, number], [number, number]];
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let a, b, d, e, g = 0, k = 0;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    a = x1 - x0; b = x3 - x0; d = y1 - y0; e = y3 - y0;
  } else {
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    k = (dx1 * sy - sx * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + k * x3; d = y1 - y0 + g * y1; e = y3 - y0 + k * y3;
  }
  return [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
}

export function validBounds(value: RadarBounds): boolean {
  const [[s, w], [n, e]] = value;
  return [s, w, n, e].every(Number.isFinite) && s >= -85 && n <= 85 && w >= -180 && e <= 180 && s < n && w < e;
}

// These are starting handles, not an asserted geographic calibration.
export function initialBounds(lat: number, lon: number): RadarBounds {
  const dy = 240 / 111.32;
  const dx = dy / Math.cos(lat * Math.PI / 180);
  return [[lat - dy, lon - dx], [lat + dy, lon + dx]];
}

const ECHO_COLOURS = new Set([
  '0,0,252', '0,148,252', '0,252,252', '0,192,0', '0,255,0',
  '255,255,0', '255,187,0', '255,127,0', '255,0,0', '200,0,90', '67,131,35',
]);

const YELLOW = '255,255,0';

/** The GIF uses the same yellow for outlines and echoes. Suppress thin yellow
 * linework conservatively; yellow touching other echoes or in solid blocks stays.
 * Used only when no fixed outline map is available for the radar.
 */
export function maskEchoPixels(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(data);
  const colour = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return '';
    const i = (y * width + x) * 4;
    return `${data[i]},${data[i + 1]},${data[i + 2]}`;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = colour(x, y);
      let keep = ECHO_COLOURS.has(rgb);
      if (rgb === YELLOW) {
        let neighbourEcho = false;
        let block = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const c = colour(x + dx, y + dy);
          if (c !== YELLOW && ECHO_COLOURS.has(c)) neighbourEcho = true;
        }
        for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
          if ([colour(x + dx, y), colour(x, y + dy), colour(x + dx, y + dy)].every(c => c === rgb)) block = true;
        }
        keep = neighbourEcho || block;
      }
      output[(y * width + x) * 4 + 3] = keep ? 255 : 0;
    }
  }
  return output;
}

/**
 * Removes AEMET's province/coast linework using the radar's fixed outline map
 * (1 = outline pixel). Yellow outside the map is real 48 dBZ echo and stays.
 * Outline pixels drawn over rain take the most common echo colour of their
 * unmasked neighbours when rain surrounds them; otherwise they become clear.
 */
export function removeOutlines(data: Uint8ClampedArray, width: number, height: number, outline: Uint8Array): Uint8ClampedArray {
  const output = new Uint8ClampedArray(data);
  const colour = (i: number) => `${data[i * 4]},${data[i * 4 + 1]},${data[i * 4 + 2]}`;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const rgb = colour(i);
      if (!outline[i]) {
        output[i * 4 + 3] = ECHO_COLOURS.has(rgb) ? 255 : 0;
        continue;
      }
      // Non-yellow echo on an outline pixel is measured data drawn over the line.
      if (rgb !== YELLOW && ECHO_COLOURS.has(rgb)) { output[i * 4 + 3] = 255; continue; }
      const neighbours: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (outline[j] || !ECHO_COLOURS.has(colour(j))) continue;
        neighbours.push(j);
      }
      if (neighbours.length < 4) { output[i * 4 + 3] = 0; continue; }
      const tally = new Map<string, { n: number; j: number }>();
      for (const j of neighbours) {
        const c = colour(j);
        const t = tally.get(c);
        tally.set(c, { n: (t?.n ?? 0) + 1, j });
      }
      let best = { n: 0, j: -1 };
      for (const t of tally.values()) if (t.n > best.n) best = t;
      output[i * 4] = data[best.j * 4]!;
      output[i * 4 + 1] = data[best.j * 4 + 1]!;
      output[i * 4 + 2] = data[best.j * 4 + 2]!;
      output[i * 4 + 3] = 255;
    }
  }
  return output;
}

/** Share of outline pixels that land on black/grey background (layout check). */
export function outlineMismatch(data: Uint8ClampedArray, outline: Uint8Array): number {
  let total = 0, off = 0;
  for (let i = 0; i < outline.length; i++) {
    if (!outline[i]) continue;
    total++;
    const rgb = `${data[i * 4]},${data[i * 4 + 1]},${data[i * 4 + 2]}`;
    if (rgb !== YELLOW && !ECHO_COLOURS.has(rgb)) off++;
  }
  return total ? off / total : 1;
}

const outlineCache = new Map<string, Promise<Uint8Array | null>>();
function loadOutline(code: string): Promise<Uint8Array | null> {
  let pending = outlineCache.get(code);
  if (!pending) {
    pending = (async () => {
      try {
        const img = new Image();
        img.src = `/aemet-masks/${encodeURIComponent(code)}.png`;
        await img.decode();
        if (img.naturalWidth !== 480 || img.naturalHeight !== 460) return null;
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 460;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, 480, 460).data;
        const out = new Uint8Array(480 * 460);
        for (let i = 0; i < out.length; i++) out[i] = px[i * 4]! > 127 ? 1 : 0;
        return out;
      } catch {
        return null;
      }
    })();
    outlineCache.set(code, pending);
  }
  return pending;
}

/** Latest image; `observedAt` is the time printed on it (null if unreadable). */
export async function loadAemetImages(code: string, tick: number): Promise<{ original: string; echoes: string; observedAt: string | null }> {
  const response = await fetch(`/api/public/aemet-radar?r=${encodeURIComponent(code)}&t=${tick}`);
  if (!response.ok || response.status === 204) throw new Error('No se pudo cargar la imagen de AEMET.');
  const observedAt = response.headers.get('x-observed-at');
  const blobUrl = URL.createObjectURL(await response.blob());
  try {
    return { ...(await processAemetImage(code, blobUrl)), observedAt };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/** Crops the raw AEMET GIF at `src` and strips everything but the echoes. */
export async function processAemetImage(code: string, src: string): Promise<{ original: string; echoes: string }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  if (img.naturalWidth !== 480 || img.naturalHeight !== 530) throw new Error('El formato de la imagen de AEMET ha cambiado; no se aplicará una alineación incorrecta.');
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 460;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  // Same crop in alignment and echo mode: no header, footer or colour legend.
  ctx.drawImage(img, 0, 20, 480, 460, 0, 0, 480, 460);
  const original = canvas.toDataURL('image/png');
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const outline = await loadOutline(code);
  // A shifted AEMET layout would put the outline map on background pixels.
  const usable = outline && outlineMismatch(pixels.data, outline) < 0.2;
  pixels.data.set(usable
    ? removeOutlines(pixels.data, canvas.width, canvas.height, outline)
    : maskEchoPixels(pixels.data, canvas.width, canvas.height));
  ctx.putImageData(pixels, 0, 0);
  return { original, echoes: canvas.toDataURL('image/png') };
}
/** Rotates corners by `degrees` (clockwise on the map) around their centre, locally Mercator-scaled. */
export function rotateCorners(c: Corners, degrees: number): Corners {
  const lat0 = c.reduce((a, p) => a + p[0], 0) / 4, lon0 = c.reduce((a, p) => a + p[1], 0) / 4;
  const k = Math.cos(lat0 * Math.PI / 180), r = degrees * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
  return c.map(([lat, lon]) => {
    const x = (lon - lon0) * k, y = -(lat - lat0);
    return [lat0 - (x * sin + y * cos), lon0 + (x * cos - y * sin) / k];
  }) as Corners;
}
