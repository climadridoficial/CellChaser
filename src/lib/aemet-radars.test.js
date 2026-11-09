import { expect, test } from "bun:test";
import { aemetOnlyStations, knownOperaStations, aemetCodeFor, OPERA_TO_AEMET } from "./aemet-radars";

test('Tenerife remains selectable during catalogue failure without invented OpenData or scans', () => {
  const stations = knownOperaStations([]);
  expect(stations).toHaveLength(1);
  expect(stations[0]).toMatchObject({ id: '0-724-0-esbnv', lat: 28.3109300583601, lon: -16.823839880526066, offline: false, products: [] });
  expect(aemetCodeFor(stations[0])).toBeNull();
});

test('discovered Tenerife replaces its static location without duplicates', () => {
  expect(knownOperaStations([{ id: '0-724-0-esbnv', code: 'esbnv' }])).toEqual([]);
});

test("OPERA discovery outage preserves all fifteen AEMET radar locations without inventing live scans", () => {
  const stations = aemetOnlyStations([]);
  expect(stations).toHaveLength(15);
  expect(new Set(stations.map(s => s.aemetCode)).size).toBe(15);
  expect(stations.every(s => s.products.length === 0)).toBe(true);
  expect(stations.filter(s => s.offline)).toHaveLength(5);
  expect(stations.find(s => s.aemetCode === "ma")).toMatchObject({lat: 40.1759, lon: -3.7136});
});

test("catalogue failure does not mark the ten known OPERA transmitters as AEMET-only", () => {
  const stations = aemetOnlyStations([]);
  expect(stations.find(s => s.aemetCode === "vd")).toMatchObject({id: "0-724-0-eslid", code: "eslid", offline: false});
  expect(stations.filter(s => !s.offline)).toHaveLength(10);
});

test("recovered OPERA radars replace their fallback markers without duplicates", () => {
  const opera = Object.keys(OPERA_TO_AEMET).map(code => ({code}));
  const fallback = aemetOnlyStations(opera);
  expect(fallback).toHaveLength(5);
  expect(fallback.map(s => s.aemetCode).sort()).toEqual(["co", "mu", "pm", "sa", "va"]);
});