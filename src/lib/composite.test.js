import { expect, test } from "bun:test";
import { compositeSource } from "./composite";

test("OpenData-only mode always uses the AEMET image, even when OPERA works", () => {
  expect(compositeSource("opendata", true, "ok")).toBe("aemet");
});

test("OPERA-first mode uses OPERA when the radar is transmitting", () => {
  expect(compositeSource("opera-fallback", true, "ok")).toBe("opera");
});

test("OPERA-first mode falls back to OpenData when OPERA has no recent scan", () => {
  expect(compositeSource("opera-fallback", true, "missing")).toBe("aemet");
  expect(compositeSource("opera-fallback", true, null)).toBe("aemet");
});

test("OPERA-only mode never shows AEMET images", () => {
  expect(compositeSource("opera", true, "missing")).toBe(null);
  expect(compositeSource("opera", true, null)).toBe(null);
});

test("off shows nothing", () => {
  expect(compositeSource("off", true, "ok")).toBe(null);
});
