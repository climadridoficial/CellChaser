import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { HISTORY_HOURS, STEP_MS, STEPS, pickFrame, slotAt, slotIndex } from "./timeline";
import { pickScan } from "./ord";
import { aemetGifTime } from "./aemet-timestamp";

const NOW = Date.parse("2026-10-29T17:18:34Z");

test("slider covers the past 6 hours in 10-minute steps", () => {
  expect(HISTORY_HOURS).toBe(6);
  expect(STEP_MS).toBe(10 * 60_000);
  expect(STEPS).toBe(36);
  expect(new Date(slotAt(0, NOW)).toISOString()).toBe("2026-10-29T11:10:00.000Z");
  expect(new Date(slotAt(STEPS - 1, NOW)).toISOString()).toBe("2026-10-29T17:00:00.000Z");
  expect(slotAt(STEPS, NOW)).toBeNull();
});

test("slider index and time round-trip", () => {
  for (const i of [0, 7, 35]) expect(slotIndex(slotAt(i, NOW), NOW)).toBe(i);
  expect(slotIndex(null, NOW)).toBe(STEPS);
});

test("a frame is used only for its own 10-minute slot", () => {
  const at = Date.parse("2026-10-29T16:00:00Z");
  const frames = ["15:40", "15:50", "16:00", "16:10"].map((t) => ({ t: Date.parse(`2026-10-29T${t}:00Z`) }));
  expect(pickFrame(frames, (f) => f.t, at)?.t).toBe(at);
  expect(pickFrame([frames[0]], (f) => f.t, at)).toBeNull();
});

test("OPERA history prefers the long-range lowest scan at the slider time", () => {
  const scans = [
    { href: "a", time: "2026-10-29T16:00:00Z", level: 0.5, doppler: false },
    { href: "b", time: "2026-10-29T15:57:00Z", level: 0.5, doppler: true },
    { href: "c", time: "2026-10-29T16:00:00Z", level: 1.3, doppler: false },
    { href: "d", time: "2026-10-29T16:10:00Z", level: 0.5, doppler: false },
  ];
  expect(pickScan(scans, Date.parse("2026-10-29T16:00:00Z"), STEP_MS)?.href).toBe("a");
  expect(pickScan(scans, Date.parse("2026-10-29T15:30:00Z"), STEP_MS)).toBeNull();
});

test("reads the observation time printed on AEMET images", () => {
  const read = (f) => aemetGifTime(new Uint8Array(readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url))));
  expect(read("aemet-ma-1710.gif")).toBe("2026-10-29T17:10:00Z");
  expect(read("aemet-vd-1700.gif")).toBe("2026-10-29T17:00:00Z");
});

test("an AEMET digit without a captured glyph is solved from the publishing lag", async () => {
  const { decodeGif, readAemetTimestamp } = await import("./aemet-timestamp");
  const { width, height, rgba } = decodeGif(new Uint8Array(readFileSync(new URL("./__fixtures__/aemet-ma-1710.gif", import.meta.url))));
  // Turn the minute-tens "1" into an unseen glyph; only 4 or 8 remain uncaptured.
  const i = (523 * width + 27 + 9 * 33 + 8) * 4;
  rgba[i] = 200; rgba[i + 1] = 0; rgba[i + 2] = 90;
  expect(readAemetTimestamp(rgba, width, height, Date.parse("2026-10-29T17:52:00Z"))).toBe("2026-10-29T17:40:00Z");
  expect(readAemetTimestamp(rgba, width, height, Date.parse("2026-10-29T16:40:00Z"))).toBeNull();
  expect(readAemetTimestamp(rgba, width, height)).toBeNull();
});
