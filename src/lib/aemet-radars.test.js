import { expect, test } from "bun:test";
import { aemetOnlyStations, OPERA_TO_AEMET } from "./aemet-radars";

test("OPERA discovery outage preserves all fifteen AEMET radar locations without inventing live scans", () => {
  const stations = aemetOnlyStations([]);
  expect(stations).toHaveLength(15);
  expect(new Set(stations.map(s => s.aemetCode)).size).toBe(15);
  expect(stations.every(s => s.offline && s.products.length === 0)).toBe(true);
  expect(stations.find(s => s.aemetCode === "ma")).toMatchObject({lat: 40.1759, lon: -3.7136});
});

test("recovered OPERA radars replace their fallback markers without duplicates", () => {
  const opera = Object.keys(OPERA_TO_AEMET).map(code => ({code}));
  const fallback = aemetOnlyStations(opera);
  expect(fallback).toHaveLength(5);
  expect(fallback.map(s => s.aemetCode).sort()).toEqual(["co", "mu", "pm", "sa", "va"]);
});