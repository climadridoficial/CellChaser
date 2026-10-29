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
  "..####...|.#.......|#........|#.####...|##....#..|#.....#..|#.....#..|.#####...": 6,
  "#######..|......#..|.....#...|....#....|...#.....|..#......|.#.......|#........": 7,
  ".#####...|#.....#..|#.....#..|#....##..|.####.#..|......#..|.....#...|.####....": 9,
};

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
export function readAemetTimestamp(rgba: ArrayLike<number>, width: number, height: number): string | null {
  if (width !== 480 || height !== 530) return null;
  const read = (cells: number[]) => {
    let out = "";
    for (const k of cells) {
      const d = DIGITS[cellKey(rgba, width, k)];
      if (d === undefined) return null;
      out += d;
    }
    return out;
  };
  const dd = read([18, 19]);
  const yy = read([25, 26]);
  const doy = read([27, 28, 29]);
  const hms = read([31, 32, 33, 34, 35, 36]);
  if (!dd || !yy || !doy || !hms) return null;
  const h = Number(hms.slice(0, 2));
  const m = Number(hms.slice(2, 4));
  const s = Number(hms.slice(4, 6));
  if (h > 23 || m > 59 || s > 59 || Number(doy) < 1 || Number(doy) > 366) return null;
  const date = new Date(Date.UTC(2000 + Number(yy), 0, Number(doy), h, m, s));
  // Day-of-month and day-of-year are printed separately: they must agree.
  if (date.getUTCDate() !== Number(dd)) return null;
  return date.toISOString().replace(".000Z", "Z");
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
export function aemetGifTime(bytes: Uint8Array): string | null {
  try {
    const { width, height, rgba } = decodeGif(bytes);
    return readAemetTimestamp(rgba, width, height);
  } catch {
    return null;
  }
}
