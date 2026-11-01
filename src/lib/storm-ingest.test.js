import { expect, test } from 'bun:test';
import { ingestStormSource, fetchStormVolume } from './storm-ingest.server';

function stateClient() {
  const states = [];
  return { states, client: { from() { return { async upsert(row) { states.push(row); return { error: null }; } }; } } };
}
test('Gran Canaria processing failure does not declare a verified live AEMET source offline', async () => {
  const { client, states } = stateClient();
  await expect(ingestStormSource(client, '0-724-0-esatn', 'aemet', async () => 'fresh image', async () => { throw new Error('decode failed'); })).rejects.toThrow('decode failed');
  expect(states.map(s => s.available)).toEqual([true]);
});
test('an actual upstream outage hides live predictions and a cached successful fetch restores availability', async () => {
  const { client, states } = stateClient();
  let processed = false;
  await expect(ingestStormSource(client, '0-724-0-esatn', 'aemet', async () => { throw new Error('outage'); }, async () => { processed = true; })).rejects.toThrow('outage');
  expect(processed).toBe(false);
  await ingestStormSource(client, '0-724-0-esatn', 'aemet', async () => 'cached observation', async () => 'already processed');
  expect(states.map(s => s.available)).toEqual([false, true]);
});
test('OPERA and VRAD downloads use Worker-compatible redirects and refuse redirected radar hosts', async () => {
  const original = globalThis.fetch;
  const modes = [];
  try {
    globalThis.fetch = async (_url, init) => { modes.push(init.redirect); return new Response(new Uint8Array([1,2,3])); };
    expect(new Uint8Array(await fetchStormVolume('https://s3.waw3-1.cloudferro.com/dbzh.h5'))).toEqual(new Uint8Array([1,2,3]));
    expect(new Uint8Array(await fetchStormVolume('https://api.meteogate.eu/vrad.h5'))).toHaveLength(3);
    expect(modes).toEqual(['manual','manual']);
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/scan' } });
    await expect(fetchStormVolume('https://radar.meteogate.eu/scan.h5')).rejects.toThrow('Radar download unavailable');
    await expect(fetchStormVolume('https://untrusted.example/scan.h5')).rejects.toThrow('Untrusted radar host');
  } finally { globalThis.fetch = original; }
});