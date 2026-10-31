import { quadMatrix } from './aemet-overlay';

// Age relative to the end of AEMET's displayed 12-hour window.
export const LIGHTNING_AGES = [
  { hours: '0–2', rgb: [255, 255, 0], token: 'recent' },
  { hours: '2–4', rgb: [255, 0, 0], token: 'red' },
  { hours: '4–6', rgb: [255, 255, 255], token: 'white' },
  { hours: '6–8', rgb: [0, 255, 0], token: 'green' },
  { hours: '8–10', rgb: [0, 255, 255], token: 'cyan' },
  { hours: '10–12', rgb: [0, 0, 255], token: 'old' },
] as const;

export function lightningAge(pixel: readonly number[]): string | null {
  if ((pixel[3] ?? 0) < 30) return null;
  return LIGHTNING_AGES.find(age => age.rgb.every((v, i) => Math.abs(v - (pixel[i] ?? 0)) < 30))?.hours ?? null;
}

/** Invert the exact image homography, including rotated/stretched corners. */
export function quadFraction(point: [number, number], corners: [number, number][], width: number, height: number): [number, number] | null {
  const m = quadMatrix(width, height, corners);
  const a = (m[0] ?? 0) - point[0] * (m[3] ?? 0);
  const b = (m[4] ?? 0) - point[0] * (m[7] ?? 0);
  const c = (m[1] ?? 0) - point[1] * (m[3] ?? 0);
  const d = (m[5] ?? 0) - point[1] * (m[7] ?? 0);
  const x = point[0] - (m[12] ?? 0), y = point[1] - (m[13] ?? 0);
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const u = (x * d - b * y) / det / width, v = (a * y - x * c) / det / height;
  return Number.isFinite(u) && Number.isFinite(v) && u >= 0 && u < 1 && v >= 0 && v < 1 ? [u, v] : null;
}