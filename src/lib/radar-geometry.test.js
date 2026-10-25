import { describe, expect, test } from "bun:test";
import { latitudeFromY, mercatorY, polarAt, rangeStartMetres, rayLookup } from "./radar-geometry";

describe("raw scan geometry", () => {
  test("ODIM 2.4 starts at 167 metres, not a 167 km ring", () => {
    expect(rangeStartMetres(167, "ODIM_H5/V2_4")).toBe(167);
    expect(rangeStartMetres(167, "ODIM_H5/V2_4") + 249 * 1000).toBe(249167);
  });
  test("older ODIM kilometre ranges remain supported", () => {
    expect(rangeStartMetres(0.167, "ODIM_H5/V2_2")).toBe(167);
  });
  test("Mercator pixels preserve latitude and station position", () => {
    expect(latitudeFromY(mercatorY(39.42883))).toBeCloseTo(39.42883, 8);
    expect(polarAt(39.42883, -6.28528, 39.42883, -6.28528).distance).toBe(0);
    expect(polarAt(40.42883, -6.28528, 39.42883, -6.28528).bearing).toBe(0);
  });
  test("measured azimuth intervals wrap north and leave sector gaps empty", () => {
    const rays = rayLookup(2, [359, 90], [1, 91]);
    expect(rays[0]).toBe(0);
    expect(rays[3595]).toBe(0);
    expect(rays[905]).toBe(1);
    expect(rays[1800]).toBe(-1);
  });
});