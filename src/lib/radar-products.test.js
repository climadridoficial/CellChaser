import { expect, test } from "bun:test";
import { colorFor, productInfo } from "./radar-products";
import { colorToValue } from "./inspector";

for (const product of ["DBZH", "DBZV", "TH", "TV"]) {
  test(`${product} preserves valid weak and clutter echoes below the former -15 dBZ cutoff`, () => {
    const info = productInfo(product);
    for (const value of [-40, -32, -25, -20, -15, 0, 12, 35, 75]) {
      expect(colorFor(info, value)[3]).toBe(255);
    }
  });
  test(`${product} inspector reads newly visible -25 dBZ echoes`, () => {
    const info = productInfo(product);
    const [r, g, b] = colorFor(info, -25);
    expect(Math.abs(colorToValue(info, r, g, b) + 25)).toBeLessThan(1);
  });
}
test("invalid measurements remain transparent rather than becoming false echoes", () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(colorFor(productInfo("DBZH"), value)).toEqual([0, 0, 0, 0]);
  }
});