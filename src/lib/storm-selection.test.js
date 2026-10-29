import { test, expect } from "bun:test";
import { stormTargets, stormSource } from "./storm-selection";
const stations = [{id:"0-724-0-estjv",country:"724"},{id:"aemet-mu",country:"724"},{id:"0-250-0-frabc",country:"250"}];
test("composite off still targets Spanish radar tracking and uses automatic source selection",()=>{
  expect(stormSource("off")).toBe("auto");
  expect(stormTargets(stations,null)).toEqual(["0-724-0-estjv","aemet-mu"]);
});
test("selected AEMET radar stays a tracking target without a rendered image",()=>{
  expect(stormTargets(stations,"aemet-mu")).toEqual(["aemet-mu"]);
});