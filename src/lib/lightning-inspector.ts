import { quadMatrix } from './aemet-overlay';

// Age relative to the end of AEMET's displayed 12-hour window.
export const LIGHTNING_AGES = [
  { hours: '0–2', bin: 5, rgb: [255, 255, 0], token: 'recent' },
  { hours: '2–4', bin: 4, rgb: [255, 0, 0], token: 'red' },
  { hours: '4–6', bin: 3, rgb: [255, 255, 255], token: 'white' },
  { hours: '6–8', bin: 2, rgb: [0, 255, 0], token: 'green' },
  { hours: '8–10', bin: 1, rgb: [0, 255, 255], token: 'cyan' },
  { hours: '10–12', bin: 0, rgb: [0, 0, 255], token: 'old' },
] as const;

export function lightningAge(pixel: readonly number[]): string | null {
  if ((pixel[3] ?? 0) < 30) return null;
  return LIGHTNING_AGES.find(age => age.rgb.every((v, i) => Math.abs(v - (pixel[i] ?? 0)) < 30))?.hours ?? null;
}

export function lightningInterval(period: { start: number; end: number }, bin: number): { start: number; end: number } {
  const step = (period.end - period.start) / 6;
  return { start: period.start + bin * step, end: period.start + (bin + 1) * step };
}

export function lightningClock(period: { start: number; end: number }, bin: number): string {
  const interval = lightningInterval(period, bin);
  const clock = (time: number) => new Date(time).toISOString().slice(11, 16);
  return `${clock(interval.start)}–${clock(interval.end)}`;
}

export function lightningElapsed(period: { start: number; end: number }, bin: number, now: number): string {
  const interval = lightningInterval(period, bin);
  const minutes = (time: number) => Math.max(0, Math.round((now - time) / 60_000));
  const duration = (n: number) => `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, '0')} min`;
  return `${duration(minutes(interval.end))}–${duration(minutes(interval.start))}`;
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