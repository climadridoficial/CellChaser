import { expect, test } from "bun:test";
import { compositeRenderKey, compositeRenderSize } from "./radar-render-policy";

for (const id of ["0-724-0-eslid", "0-724-0-essse"]) {
  test(`${id} shared composite and individual images use 1600 pixels, not the reduced 800`, () => {
    expect(compositeRenderSize(id)).toBe(1600);
    expect(compositeRenderKey({id,lat:42,lon:-4},{href:"volume",level:0.5})[5]).toBe(1600);
  });
}
test("different elevations in the same volume never reuse the same rendered image", () => {
  const station = {id:"0-724-0-eslid",lat:42,lon:-4};
  expect(compositeRenderKey(station,{href:"volume",level:0.5})).not.toEqual(compositeRenderKey(station,{href:"volume",level:1.4}));
});
test("other composite radars keep their existing rendering budget", () => {
  expect(compositeRenderSize("0-724-0-esatn")).toBe(800);
});