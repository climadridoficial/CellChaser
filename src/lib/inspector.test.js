import { describe, it, expect } from "vitest";
import { colorToValue } from "./inspector";
import { colorFor, productInfo } from "./radar-products";
describe("inspector", () => {
  it("reads dBZ back from the reflectivity colour", () => {
    const info = productInfo("DBZH");
    const [r, g, b] = colorFor(info, 45);
    expect(Math.abs(colorToValue(info, r, g, b) - 45)).toBeLessThan(1);
  });
  it("reads velocity back from the Doppler colour", () => {
    const info = productInfo("VRADH");
    const [r, g, b] = colorFor(info, -20);
    expect(Math.abs(colorToValue(info, r, g, b) + 20)).toBeLessThan(1);
  });
});
