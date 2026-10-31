import { expect, test } from 'bun:test';
import { lightningAge, quadFraction } from './lightning-inspector';

test('AEMET yellow is the newest 0–2 h band and blue the oldest 10–12 h', () => {
  expect(lightningAge([255,255,0,255])).toBe('0–2');
  expect(lightningAge([0,0,255,255])).toBe('10–12');
  expect(lightningAge([255,255,255,255])).toBe('4–6');
});
test('transparent pixels and province outlines are not lightning strikes', () => {
  expect(lightningAge([255,0,0,0])).toBeNull();
  expect(lightningAge([255,0,255,255])).toBeNull();
});
test('inspector respects independently stretched image corners', () => {
  const result = quadFraction([50,50], [[0,0],[100,0],[80,100],[20,100]],100,100);
  expect(result?.[0]).toBeCloseTo(0.5);
  expect(result?.[1]).toBeCloseTo(0.375);
  expect(quadFraction([120,50], [[0,0],[100,0],[80,100],[20,100]],100,100)).toBeNull();
});