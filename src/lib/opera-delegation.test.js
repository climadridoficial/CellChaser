import { expect, test } from 'bun:test';
import { sharedOperaResponse } from './opera-cache.server';

test('Vercel delegation forwards decoded catalogue bytes without upstream compression headers', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async () => new Response('{"features":[{"id":"0-724-0-esbnv"}]}', {
    headers: { 'content-encoding': 'gzip', 'content-length': '18', 'content-type': 'application/json', 'x-opera-cache': 'hit' },
  });
  try {
    const response = await sharedOperaResponse('https://api.meteogate.eu/collections/observations/locations', null, 'https://www.cellchaser.com');
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('x-opera-cache')).toBe('hit');
    expect(await response.json()).toEqual({ features: [{ id: '0-724-0-esbnv' }] });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test('delegation preserves genuine OPERA limits and retry timing', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async () => new Response('OPERA temporarily busy', { status: 429, headers: { 'retry-after': '120', 'cache-control': 'no-store', 'content-encoding': 'gzip' } });
  try {
    const response = await sharedOperaResponse('https://api.meteogate.eu/collections/observations/locations');
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('120');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('OPERA temporarily busy');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});