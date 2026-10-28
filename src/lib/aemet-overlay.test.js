import { expect, test } from 'bun:test';
import { AEMET_REFRESH_MS, maskEchoPixels, validBounds } from './aemet-overlay';

test('AEMET overlays refresh every 10 minutes', () => {
  expect(AEMET_REFRESH_MS).toBe(600000);
});
test('removes black and grey background while preserving measured echoes unchanged', () => {
  const pixels = new Uint8ClampedArray([0,0,0,255, 127,127,127,255, 0,0,252,255, 255,0,0,255]);
  expect([...maskEchoPixels(pixels, 4, 1)]).toEqual([0,0,0,0, 127,127,127,0, 0,0,252,255, 255,0,0,255]);
});
test('removes isolated yellow outlines but retains solid yellow echoes', () => {
  const thin = new Uint8ClampedArray([255,255,0,255, 255,255,0,255]);
  expect(maskEchoPixels(thin, 2, 1)[3]).toBe(0);
  const block = new Uint8ClampedArray(Array(4).fill([255,255,0,255]).flat());
  expect([...maskEchoPixels(block, 2, 2)]).toEqual([...block]);
});
test('rejects reversed and nonfinite saved image bounds', () => {
  expect(validBounds([[37,-3],[40,1]])).toBe(true);
  expect(validBounds([[40,-3],[37,1]])).toBe(false);
  expect(validBounds([[37,NaN],[40,1]])).toBe(false);
});