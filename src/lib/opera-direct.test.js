import { expect, test, beforeEach } from 'bun:test';
import { directOperaResponse, resetDirectOpera } from './opera-direct';
import { operaTarget } from './opera-cache-policy';

beforeEach(() => resetDirectOpera());

test('paused backend still serves real OPERA volumes from the new object store, downloading once', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'binary/octet-stream' } }); };
  try {
    const target = operaTarget('https://object-store.os-api.cci1.ecmwf.int/openradar-24h-backup/2026/11/17/ES/escll/PVOL/x.h5');
    const [a, b] = await Promise.all([directOperaResponse(target), directOperaResponse(target)]);
    expect(a.status).toBe(200);
    expect([...new Uint8Array(await b.arrayBuffer())]).toEqual([1, 2, 3]);
    await directOperaResponse(target);
    expect(calls).toBe(1);
  } finally { globalThis.fetch = original; }
});

test('a genuine OPERA 429 blocks further direct requests until Retry-After', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', { status: 429, headers: { 'retry-after': '120' } }); };
  try {
    const first = await directOperaResponse(operaTarget('https://api.meteogate.eu/a'));
    const second = await directOperaResponse(operaTarget('https://api.meteogate.eu/b'));
    expect(first.status).toBe(429);
    expect(second.status).toBe(429);
    expect(Number(second.headers.get('retry-after'))).toBeGreaterThan(100);
    expect(calls).toBe(1);
  } finally { globalThis.fetch = original; }
});
