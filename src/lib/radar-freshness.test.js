import { expect, test } from "bun:test";
import { radarFrameVisible } from "./radar-freshness";
import { AEMET_LIVE_MAX_AGE_MS, OPERA_MAX_AGE_MS } from "./composite";

const now = Date.parse("2026-10-29T17:40:00Z");

for (const [source, maxAge] of [["AEMET", AEMET_LIVE_MAX_AGE_MS], ["OPERA", OPERA_MAX_AGE_MS]]) {
  test(`${source} outdated or failed-source data is hidden live but visible at its historical slot`, () => {
    const old = "2026-10-29T16:00:00Z";
    expect(radarFrameVisible(old, null, maxAge, now)).toBe(false);
    expect(radarFrameVisible(old, Date.parse(old), maxAge, now, true)).toBe(true);
    expect(radarFrameVisible("2026-10-29T17:30:00Z", null, maxAge, now, true)).toBe(false);
    expect(radarFrameVisible("2026-10-29T17:30:00Z", null, maxAge, now)).toBe(true);
    expect(radarFrameVisible(new Date(now - maxAge).toISOString(), null, maxAge, now)).toBe(false);
  });
}

test("unreadable timestamps and frames from another historical slot are hidden", () => {
  expect(radarFrameVisible(null, null, OPERA_MAX_AGE_MS, now)).toBe(false);
  expect(radarFrameVisible("invalid", null, OPERA_MAX_AGE_MS, now)).toBe(false);
  expect(radarFrameVisible("2026-10-29T16:00:00Z", Date.parse("2026-10-29T17:00:00Z"), OPERA_MAX_AGE_MS, now)).toBe(false);
});