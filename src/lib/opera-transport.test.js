import { expect, test } from 'bun:test';
import { operaBrowserResponse, assertOperaAvailable } from './opera-transport';

test('paused shared cache becomes explicit unavailability, not empty station data or binary bytes', async () => {
  const response = await operaBrowserResponse(new Response('Shared radar cache unavailable', { status: 503 }));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(() => assertOperaAvailable(response)).toThrow('OPERA shared cache unavailable');
  expect(await response.json()).toEqual({ error: { code: 'OPERA_CACHE_UNAVAILABLE' } });
});

test('queue saturation still permits existing bounded 503 retries', async () => {
  const original = new Response('Shared radar queue busy', { status: 503, headers: { 'Retry-After': '2' } });
  const response = await operaBrowserResponse(original);
  expect(response).toBe(original);
  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('2');
});

test('provider limits and real empty scans retain their distinct meanings', async () => {
  for (const status of [429, 204]) {
    const original = new Response(null, { status });
    expect(await operaBrowserResponse(original)).toBe(original);
    expect(() => assertOperaAvailable(original)).not.toThrow();
  }
});