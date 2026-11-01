// Reads the observation time AEMET prints in the footer of its regional radar
// GIFs ("29 OCT 26302 171000" = day 302 of 2026, 17:10:00 UTC). AEMET OpenData
// serves only the latest image, often 10+ minutes late, so the printed time is
// the only reliable label for archived frames.
import * as omggif from "omggif";

const INK = [200, 0, 90] as const;
const X0 = 27;
const Y0 = 519;
const CELL = 9;
const ROWS = 8;

/** 9×8 footer glyphs, rows joined by "|". Captured from real AEMET images. */
const DIGITS: Record<string, number> = {
  ".#####...|#.....#..|#.....#..|#..#..#..|#..#..#..|#.....#..|#.....#..|.#####...": 0,
  "...#.....|..##.....|...#.....|...#.....|...#.....|...#.....|...#.....|.#####...": 1,
  ".#####...|#.....#..|......#..|.....#...|..###....|.#.......|#........|#######..": 2,
  "#######..|.....#...|....#....|...##....|.....#...|......#..|#.....#..|.#####...": 3,
  "#######..|#........|#........|######...|......#..|......#..|#.....#..|.#####...": 5,
  "..####...|.#.......|#........|#.####...|##....#..|#.....#..|#.....#..|.#####...": 6,
  "#######..|......#..|.....#...|....#....|...#.....|..#......|.#.......|#........": 7,
  ".#####...|#.....#..|#.....#..|#....##..|.####.#..|......#..|.....#...|.####....": 9,
};

const ZERO_KEY = Object.keys(DIGITS).find((k) => DIGITS[k] === 0)!;

function cellKey(rgba: ArrayLike<number>, width: number, k: number): string {
  const rows: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    let row = "";
    for (let x = 0; x < CELL; x++) {
      const i = ((Y0 + y) * width + X0 + CELL * k + x) * 4;
      row += rgba[i] === INK[0] && rgba[i + 1] === INK[1] && rgba[i + 2] === INK[2] ? "#" : ".";
    }
    rows.push(row);
  }
  return rows.join("|");
}

/** Glyph bitmap for footer cell `k` (exported to capture missing digits). */
export function footerCell(rgba: ArrayLike<number>, width: number, k: number): string {
  return cellKey(rgba, width, k);
}

/** ISO UTC time printed on the image, or null if the footer can't be read. */
const CELLS = [18, 19, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36];
// AEMET publishes each image roughly 8–15 minutes after its observation time.
const MIN_LAG_MS = 4 * 60_000;
const MAX_LAG_MS = 75 * 60_000;
const TYPICAL_LAG_MS = 10 * 60_000;

function parseDigits(d: number[]): number | null {
  const n = (from: number, to: number) => Number(d.slice(from, to).join(""));
  const [dd, yy, doy, h, m, s] = [n(0, 2), n(2, 4), n(4, 7), n(7, 9), n(9, 11), n(11, 13)];
  if (h > 23 || m > 59 || s > 59 || doy < 1 || doy > 366) return null;
  const date = new Date(Date.UTC(2000 + yy, 0, doy, h, m, s));
  // Day-of-month and day-of-year are printed separately: they must agree.
  return date.getUTCDate() === dd ? date.getTime() : null;
}

/**
 * ISO UTC time printed on the image, or null if the footer can't be read.
 * Digits without a captured glyph are solved from the remaining digits, the
 * day-of-month/day-of-year cross-check and `fetchedAt` (AEMET's publishing lag).
 */
export function readAemetTimestamp(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  fetchedAt?: number,
): string | null {
  if (width !== 480 || height !== 530) return null;
  const keys = CELLS.map((k) => cellKey(rgba, width, k));
  // Single-digit days are printed with a leading space (" 1 NOV").
  if (!keys[0]!.includes("#")) keys[0] = ZERO_KEY;
  const unknown = [...new Set(keys.filter((k) => DIGITS[k] === undefined))];
  if (unknown.some((k) => !k.includes("#"))) return null;
  const known = new Set(Object.values(DIGITS));
  const spare = [...Array(10).keys()].filter((d) => !known.has(d));
  if (unknown.length > spare.length) return null;

  let best: number | null = null;
  let candidates = 0;
  const assign = (i: number, used: Map<string, number>) => {
    if (i === unknown.length) {
      const t = parseDigits(keys.map((k) => DIGITS[k] ?? used.get(k)!));
      if (t === null) return;
      if (unknown.length && fetchedAt !== undefined) {
        const lag = fetchedAt - t;
        if (lag < MIN_LAG_MS || lag > MAX_LAG_MS) return;
      }
      candidates++;
      const score = (x: number) => Math.abs((fetchedAt ?? x) - x - TYPICAL_LAG_MS);
      if (best === null || score(t) < score(best)) best = t;
      return;
    }
    for (const d of spare) {
      if ([...used.values()].includes(d)) continue;
      used.set(unknown[i]!, d);
      assign(i + 1, used);
      used.delete(unknown[i]!);
    }
  };
  if (unknown.length && fetchedAt === undefined) return null;
  assign(0, new Map());
  if (best === null || (!unknown.length && candidates !== 1)) return null;
  return new Date(best).toISOString().replace(".000Z", "Z");
}

type Reader = new (buf: Uint8Array) => {
  width: number;
  height: number;
  decodeAndBlitFrameRGBA: (frame: number, pixels: Uint8Array) => void;
};

/** Decodes the first GIF frame to RGBA (pure JS, works on the edge runtime). */
export function decodeGif(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const mod = omggif as unknown as { GifReader?: Reader; default?: { GifReader: Reader } };
  const GifReader = mod.GifReader ?? mod.default!.GifReader;
  const reader = new GifReader(bytes);
  const rgba = new Uint8Array(reader.width * reader.height * 4);
  reader.decodeAndBlitFrameRGBA(0, rgba);
  return { width: reader.width, height: reader.height, rgba };
}

/** Observation time of an AEMET regional GIF, or null. */
export function aemetGifTime(bytes: Uint8Array, fetchedAt?: number): string | null {
  try {
    const { width, height, rgba } = decodeGif(bytes);
    return readAemetTimestamp(rgba, width, height, fetchedAt);
  } catch {
    return null;
  }
}
