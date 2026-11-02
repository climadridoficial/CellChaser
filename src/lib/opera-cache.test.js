import { expect, test } from 'bun:test';
import { sharedOperaResponse } from './opera-cache.server';

test('two viewers and storm ingest reuse identical volume bytes with one upstream request', async () => {
  const original = globalThis.fetch;
  const rows = new Map(); let downloads = 0;
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.includes('/rest/v1/rpc/')) {
      const args = JSON.parse(init.body);
      if (path.endsWith('claim_opera_cache')) return Response.json(rows.get(args.p_key) ?? { kind: 'fetch' });
      rows.set(args.p_key, { kind: 'hit', body: args.p_body, status: args.p_status, contentType: args.p_type, ttl: args.p_ttl });
      return Response.json(null);
    }
    downloads++;
    return new Response(new Uint8Array([5, 10, 20]));
  };
  try {
    const url = 'https://s3.waw3-1.cloudferro.com/shared.h5';
    for (let i = 0; i < 3; i++) expect(new Uint8Array(await (await sharedOperaResponse(url)).arrayBuffer())).toEqual(new Uint8Array([5, 10, 20]));
    expect(downloads).toBe(1);
  } finally { globalThis.fetch = original; }
});
test('persisted provider cooldown suppresses requests for other radars too', async () => {
  const original = globalThis.fetch; let blocked = false, downloads = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/rest/v1/rpc/claim_opera_cache')) return Response.json(blocked ? { kind: 'blocked', retryAt: new Date(Date.now() + 120000).toISOString() } : { kind: 'fetch' });
    if (String(url).includes('/rest/v1/rpc/finish_opera_cache')) { blocked = JSON.parse(init.body).p_retry === 120; return Response.json(null); }
    downloads++; return new Response(null, { status: 429, headers: { 'Retry-After': '120' } });
  };
  try {
    expect((await sharedOperaResponse('https://api.meteogate.eu/radar-one')).headers.get('retry-after')).toBe('120');
    expect((await sharedOperaResponse('https://api.meteogate.eu/radar-two')).status).toBe(429);
    expect(downloads).toBe(1);
  } finally { globalThis.fetch = original; }
});