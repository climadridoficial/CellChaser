import { expect, test } from "bun:test";
import { fetchScanFiles } from "./ord";

test("velocity selects its own multi-product volume without the broken parameter filter", async () => {
  const original = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return Response.json({ coverages: [
      { parameters: { "DBZH:scan": {}, "TH:scan": {} }, links: [{ type: "application/x-odim", href: "https://example.org/radar@20261025T2150@DBZH_TH.h5" }] },
      { parameters: { "DBZH:scan": {}, "VRADH:scan": {} }, links: [{ type: "application/x-odim", href: "https://example.org/radar@20261025T2147@DBZH_VRADH.h5" }] },
    ] });
  };
  try {
    const files = await fetchScanFiles({ platform: "0-724-0-essft", parameterName: "VRADH:scan", level: 0.5, hours: 1 });
    expect(new URL(requestedUrl).searchParams.has("parameter-name")).toBe(false);
    expect(files.map((f) => f.href)).toEqual(["https://example.org/radar@20261025T2147@DBZH_VRADH.h5"]);
  } finally {
    globalThis.fetch = original;
  }
});