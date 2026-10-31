import { expect, test } from 'bun:test';
import { lightningAge, quadFraction, lightningClock, lightningElapsed } from './lightning-inspector';

test('AEMET yellow is the newest 0–2 h band and blue the oldest 10–12 h', () => {
  expect(lightningAge([255,255,0,255])).toBe('0–2');
  expect(lightningAge([0,0,255,255])).toBe('10–12');
  expect(lightningAge([255,255,255,255])).toBe('4–6');
});
test('transparent pixels and province outlines are not lightning strikes', () => {
  expect(lightningAge([255,0,0,0])).toBeNull();
  expect(lightningAge([255,0,255,255])).toBeNull();
});
test('legend shows observation hours while inspector calculates elapsed time including publication delay', () => {
  const period = { start: Date.parse('2026-10-31T00:00:00Z'), end: Date.parse('2026-10-31T12:00:00Z') };
  expect(lightningClock(period, 5)).toBe('10:00–12:00');
  expect(lightningElapsed(period, 5, Date.parse('2026-10-31T12:51:00Z'))).toBe('0 h 51 min–2 h 51 min');
});
test('elapsed time includes previous dates rather than resetting at midnight', () => {
  const period = { start: Date.parse('2026-10-31T12:00:00Z'), end: Date.parse('2026-11-01T00:00:00Z') };
  expect(lightningClock(period, 5)).toBe('22:00–00:00');
  expect(lightningElapsed(period, 5, Date.parse('2026-11-01T01:00:00Z'))).toBe('1 h 00 min–3 h 00 min');
});
test('inspector respects independently stretched image corners', () => {
  const result = quadFraction([50,50], [[0,0],[100,0],[80,100],[20,100]],100,100);
  expect(result?.[0]).toBeCloseTo(0.5);
  expect(result?.[1]).toBeCloseTo(0.375);
  expect(quadFraction([120,50], [[0,0],[100,0],[80,100],[20,100]],100,100)).toBeNull();
});