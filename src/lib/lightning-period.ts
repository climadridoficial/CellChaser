export interface LightningPeriod { start: number; end: number }
// Native 7×8 AEMET glyphs captured from the unscaled lightning GIF.
const FONT: Record<string, string> = {
  "R": "#####..|#....#.|#....#.|#....#.|#####..|#..#...|#...#..|#....#.",
  "A": ".####..|#....#.|#....#.|#....#.|######.|#....#.|#....#.|#....#.",
  "Y": "#....#.|#...#..|.#.##..|.#.#...|..#....|..#....|..#....|..#....",
  "O": ".####..|#....#.|#....#.|#....#.|#....#.|#....#.|#....#.|.####..",
  "S": ".####..|#....#.|#......|#......|.####..|.....#.|#....#.|.####..",
  "F": "######.|#......|#......|#......|###....|#......|#......|#......",
  "L": "#......|#......|#......|#......|#......|#......|#......|######.",
  "G": ".####..|#....#.|#......|#......|#.####.|#....#.|#....#.|.####..",
  "P": "#####..|#....#.|#....#.|#....#.|#####..|#......|#......|#......",
  "E": "######.|#......|#......|#......|###....|#......|#......|######.",
  "I": "######.|..#....|..#....|..#....|..#....|..#....|..#....|######.",
  "D": "#####..|#....#.|#....#.|#....#.|#....#.|#....#.|#....#.|#####..",
  "3": ".####..|#....#.|.....#.|.....#.|..###..|.....#.|#....#.|.####..",
  "1": "..#....|.##....|..#....|..#....|..#....|..#....|..#....|.####..",
  "C": ".####..|#....#.|#......|#......|#......|#......|#....#.|.####..",
  "T": "######.|..#....|..#....|..#....|..#....|..#....|..#....|..#....",
  "0": ".####..|#....#.|#....#.|#....#.|#....#.|#....#.|#....#.|.####..",
  "2": ".####..|#....#.|.....#.|....#..|...#...|..#....|.#.....|######.",
  "6": ".####..|#....#.|#......|#......|#####..|#....#.|#....#.|.####..",
  "5": "######.|#......|#####..|.....#.|.....#.|.....#.|#....#.|.####..",
  "4": "..#..#.|..#..#.|.#...#.|.#...#.|######.|.....#.|.....#.|.....#.",
  "7": "######.|.....#.|....#..|....#..|...#...|...#...|..#....|..#....",
  "8": ".####..|#....#.|#....#.|#...#..|.####..|#....#.|#....#.|.####..",
  "9": ".####..|#....#.|#....#.|#....#.|.#####.|.....#.|.....#.|.####.."
  ,"N": "#....#.|##...#.|##...#.|#.#..#.|#..#.#.|#...##.|#...##.|#....#.",
  "V": "#....#.|#....#.|.#..#..|.#..#..|.#.#...|.#.#...|..#....|..#...."
};
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
export function readLightningPeriod(rgba: ArrayLike<number>, width: number, height: number, reference: number): LightningPeriod | null {
  if (width !== 640 || height !== 480) return null;
  const key = (cell: number) => Array.from({ length: 8 }, (_, y) => Array.from({ length: 7 }, (_, x) => {
    const i = ((424 + y) * width + 26 + cell * 7 + x) * 4;
    return (rgba[i] ?? 0) > 180 && (rgba[i + 1] ?? 0) > 180 && (rgba[i + 2] ?? 255) < 40 ? '#' : '.';
  }).join('')).join('|');
  const digit = (cell: number) => Object.entries(FONT).find(([c, bitmap]) => /^\d$/.test(c) && bitmap === key(cell))?.[0];
  const number = (cell: number, paddedDay = false) => { const a = digit(cell) ?? (paddedDay && !key(cell).includes('#') ? '0' : undefined), b = digit(cell + 1); return a === undefined || b === undefined ? NaN : Number(a + b); };
  const endpoint = (offset: number) => ({ day: number(offset, true), hour: number(offset + 7), minute: number(offset + 10), second: number(offset + 13), month: [key(offset + 3), key(offset + 4), key(offset + 5)] });
  const start = endpoint(21), end = endpoint(40);
  const months = (keys: string[]) => MONTHS.map((name, index) => ({ name, index })).filter(({ name }) => [...name].every((c, i) => {
    const bitmap = keys[i]; if (!bitmap?.includes('#')) return false;
    if (FONT[c]) return FONT[c] === bitmap;
    return !Object.entries(FONT).some(([known, value]) => /[A-Z]/.test(known) && value === bitmap);
  }));
  const stamp = (e: typeof start, year: number, month: number) => {
    const t = Date.UTC(year, month, e.day, e.hour, e.minute, e.second), d = new Date(t);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === e.day && d.getUTCHours() === e.hour && d.getUTCMinutes() === e.minute && d.getUTCSeconds() === e.second ? t : NaN;
  };
  const candidates: LightningPeriod[] = [];
  const year = new Date(reference).getUTCFullYear();
  for (const em of months(end.month)) for (const sm of months(start.month)) for (const ey of [year - 1, year, year + 1]) for (const sy of [ey - 1, ey]) {
    const s = stamp(start, sy, sm.index), e = stamp(end, ey, em.index);
    // Reference resolves the omitted year only; never replaces printed hours.
    if (e - s === 12 * 3600000 && reference - e >= -60000 && reference - e <= 40 * 86400000) candidates.push({ start: s, end: e });
  }
  return candidates.length === 1 ? candidates[0] ?? null : null;
}
