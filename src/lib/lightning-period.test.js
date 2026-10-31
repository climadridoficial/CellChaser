import { expect, test } from 'bun:test';
import { readLightningPeriod } from './lightning-period';

const glyphs = {
  '0': '.####..|#....#.|#....#.|#....#.|#....#.|#....#.|#....#.|.####..',
  '1': '..#....|.##....|..#....|..#....|..#....|..#....|..#....|.####..',
  '2': '.####..|#....#.|.....#.|....#..|...#...|..#....|.#.....|######.',
  '3': '.####..|#....#.|.....#.|.....#.|..###..|.....#.|#....#.|.####..',
  O: '.####..|#....#.|#....#.|#....#.|#....#.|#....#.|#....#.|.####..',
  C: '.####..|#....#.|#......|#......|#......|#......|#....#.|.####..',
  T: '######.|..#....|..#....|..#....|..#....|..#....|..#....|..#....',
};
function pixels() {
  const data = new Uint8ClampedArray(640 * 480 * 4);
  for (const [offset, text] of [[21,'31/OCT 00:00:00'],[40,'31/OCT 12:00:00']]) {
    [...text].forEach((c, cell) => glyphs[c]?.split('|').forEach((row,y) => [...row].forEach((ink,x) => {
      if (ink !== '#') return;
      const i = ((424+y)*640+26+(offset+cell)*7+x)*4; data[i]=255;data[i+1]=255;data[i+3]=255;
    })));
  }
  return data;
}
test('reads printed 00–12 UTC window without relabelling it to fetch time', () => {
  expect(readLightningPeriod(pixels(),640,480,Date.parse('2026-10-31T12:51:00Z'))).toEqual({ start:Date.parse('2026-10-31T00:00:00Z'),end:Date.parse('2026-10-31T12:00:00Z') });
});
test('unreadable period is unknown rather than an invented observation time', () => {
  expect(readLightningPeriod(new Uint8Array(640*480*4),640,480,Date.parse('2026-10-31T12:51:00Z'))).toBeNull();
});