import { expect, test } from "bun:test";
import { fetchScanFiles, fetchScanHistory, fetchStations } from "./ord";
import { withCacheRpc } from './opera-cache-test-helper';

test("empty OPERA discovery does not crash the radar list", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = withCacheRpc(async () => new Response(null, { status: 204 }));
  try {
    expect(await fetchStations()).toEqual([]);
  } finally {
    globalThis.fetch = original;
  }
});

test("all-elevation discovery preserves angles sharing one ODIM volume", async () => {
  const original = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = withCacheRpc(async (url) => {
    requestedUrl = String(url);
    return Response.json({ coverages: [0.5, 1.3, 2.1].map((level) => ({
      parameters: { "DBZH:scan": {}, "TH:scan": {} },
      domain: { axes: { z: { values: [level] } } },
      links: [{ type: "application/x-odim", href: "https://example.org/radar@20261101T1300@0.5_1.3_2.1@DBZH_TH.h5" }],
    })) });
  });
  try {
    const history = await fetchScanHistory("0-724-0-essft", "*", 1);
    expect(new URL(requestedUrl).searchParams.has("level")).toBe(false);
    expect(history.map((c) => c.level)).toEqual([0.5, 1.3, 2.1]);
    expect(history.every((c) => c.products.includes("DBZH"))).toBe(true);
  } finally { globalThis.fetch = original; }
});

for (const station of ["0-724-0-eslid", "0-724-0-essse"]) {
  test(`${station} preserves every elevation in a multi-angle coverage`, async () => {
    const original = globalThis.fetch;
    globalThis.fetch = withCacheRpc(async () => Response.json({ coverages: [{
      parameters: { "DBZH:scan": {}, "TH:scan": {} },
      domain: { axes: { z: { values: [0.5, 1.3, 2.1, 3.5, 5, 0.5] } } },
      links: [{ type: "application/x-odim", href: `https://example.org/${station}@20261102T1830@multi-angle.h5` }],
    }] }));
    try {
      const history = await fetchScanHistory(station, "*", 1);
      expect(history.map(c => c.level)).toEqual([0.5, 1.3, 2.1, 3.5, 5]);
      expect(history.every(c => c.products.includes("DBZH"))).toBe(true);
    } finally { globalThis.fetch = original; }
  });
}

test("velocity selects its own multi-product volume without the broken parameter filter", async () => {
  const original = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = withCacheRpc(async (url) => {
    requestedUrl = String(url);
    return Response.json({ coverages: [
      { parameters: { "DBZH:scan": {}, "TH:scan": {} }, links: [{ type: "application/x-odim", href: "https://example.org/radar@20261025T2150@DBZH_TH.h5" }] },
      { parameters: { "DBZH:scan": {}, "VRADH:scan": {} }, links: [{ type: "application/x-odim", href: "https://example.org/radar@20261025T2147@DBZH_VRADH.h5" }] },
    ] });
  });
  try {
    const files = await fetchScanFiles({ platform: "0-724-0-essft", parameterName: "VRADH:scan", level: 0.5, hours: 1 });
    expect(new URL(requestedUrl).searchParams.has("parameter-name")).toBe(false);
    expect(files.map((f) => f.href)).toEqual(["https://example.org/radar@20261025T2147@DBZH_VRADH.h5"]);
  } finally {
    globalThis.fetch = original;
  }
});