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
  N: '#....#.|##...#.|##...#.|#.#..#.|#..#.#.|#...##.|#...##.|#....#.',
  V: '#....#.|#....#.|.#..#..|.#..#..|.#.#...|.#.#...|..#....|..#....',
};
function pixels(start = '31/OCT 00:00:00', end = '31/OCT 12:00:00') {
  const data = new Uint8ClampedArray(640 * 480 * 4);
  for (const [offset, text] of [[21,start],[40,end]]) {
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
test('reads the real single-digit November day with a blank tens glyph', () => {
  expect(readLightningPeriod(pixels(' 2/NOV 00:00:00', ' 2/NOV 12:00:00'),640,480,Date.parse('2026-11-02T12:51:00Z'))).toEqual({start:Date.parse('2026-11-02T00:00:00Z'),end:Date.parse('2026-11-02T12:00:00Z')});
});
test('a blank hour digit remains unreadable, not a padded day', () => {
  expect(readLightningPeriod(pixels(' 2/NOV  0:00:00', ' 2/NOV 12:00:00'),640,480,Date.parse('2026-11-02T12:51:00Z'))).toBeNull();
});