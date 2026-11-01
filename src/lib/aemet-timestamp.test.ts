import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { aemetGifTime } from "./aemet-timestamp";

describe("AEMET footer timestamp", () => {
  it("reads single-digit days printed with a leading space (1 Nov 2026)", () => {
    const bytes = new Uint8Array(readFileSync(new URL("./__fixtures__/aemet-ca-day1.gif", import.meta.url)));
    expect(aemetGifTime(bytes, Date.parse("2026-11-01T12:22:00Z"))).toBe("2026-11-01T12:10:00Z");
  });
});
