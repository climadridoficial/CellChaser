import { expect, test } from "bun:test";
import { initialRadarSelection, individualRangeOptions, selectionCandidates, usableLevels, stationHasScans, matchingVelocityScan } from "./scan-availability";

const now = Date.parse("2026-11-01T13:07:00Z");
const maxAge = 20 * 60_000;
const candidates = [
  { href: "volume", time: "2026-11-01T13:00:00Z", level: 0.5, doppler: true, products: ["DBZH", "VRADH"] },
  { href: "volume", time: "2026-11-01T13:00:00Z", level: 1.5, doppler: true, products: ["DBZH", "VRADH"] },
  { href: "long", time: "2026-11-01T13:00:00Z", level: 2.1, doppler: false, products: ["DBZH"] },
  { href: "old", time: "2026-11-01T12:00:00Z", level: 4.5, doppler: true, products: ["DBZH"] },
];

test("San Sebastián exposes long range even when discovery only returns short range", () => {
  expect(individualRangeOptions("0-724-0-essse", [candidates[0]], "DBZH")).toEqual(["short", "long"]);
});
test("Valladolid exposes long range even when scan discovery is empty", () => {
  expect(individualRangeOptions("0-724-0-eslid", [], "DBZH")).toEqual(["short", "long"]);
});
test("explicit long range never silently displays a short-range volume", () => {
  expect(selectionCandidates([candidates[0]], "DBZH", "long", true)).toEqual([]);
  expect(selectionCandidates(candidates, "DBZH", "long", true).map(c => c.href)).toEqual(["long"]);
});
test("known reflectivity range capability does not invent long-range velocity", () => {
  expect(individualRangeOptions("0-724-0-eslid", [candidates[0]], "VRADH")).toEqual(["short"]);
});

test("opening individual reflectivity preserves the composite's long-range volume at the same lowest elevation", () => {
  const volumes = [candidates[0], {...candidates[2], level: 0.5}];
  const initial = initialRadarSelection(volumes, "DBZH", null, maxAge, now);
  expect(initial).toEqual({level: 0.5, range: "long"});
  expect(selectionCandidates(volumes, "DBZH", initial.range)[0].href).toBe("long");
});
test("opening a radar still prioritizes the lowest elevation over a higher long-range scan", () => {
  expect(initialRadarSelection(candidates, "DBZH", null, maxAge, now)).toEqual({level: 0.5, range: "short"});
});
test("initial volume selection cannot revive expired scans or use another historical slot", () => {
  expect(initialRadarSelection(candidates, "DBZH", null, maxAge, now + 3600_000)).toBeNull();
  expect(initialRadarSelection(candidates, "DBZH", Date.parse("2026-11-01T12:30:00Z"), maxAge, now)).toBeNull();
});

test("angles match the selected product and range, not just the catalogue", () => {
  expect(usableLevels(selectionCandidates(candidates, "DBZH", "short"), null, maxAge, now)).toEqual([0.5, 1.5]);
  expect(usableLevels(selectionCandidates(candidates, "DBZH", "long"), null, maxAge, now)).toEqual([2.1]);
  expect(usableLevels(selectionCandidates(candidates, "VRADH", "long"), null, maxAge, now)).toEqual([0.5, 1.5]);
});
test("historical angles must have a frame inside the selected ten-minute slot", () => {
  expect(usableLevels(candidates, Date.parse("2026-11-01T12:00:00Z"), maxAge, now)).toEqual([4.5]);
  expect(usableLevels(candidates, Date.parse("2026-11-01T12:30:00Z"), maxAge, now)).toEqual([]);
});
test("missing selected angle or product does not mean OPERA is down", () => {
  expect(candidates.filter((c) => c.level === 9)).toEqual([]);
  expect(selectionCandidates(candidates, "ZDR", "short")).toEqual([]);
  expect(stationHasScans(candidates, null, maxAge, now)).toBe(true);
});
test("a real station-wide absence allows fallback, and live angles expire", () => {
  expect(stationHasScans([], null, maxAge, now)).toBe(false);
  expect(stationHasScans(candidates, null, maxAge, now + 60 * 60_000)).toBe(false);
  expect(usableLevels(candidates, null, maxAge, now + 60 * 60_000)).toEqual([]);
});
test('VRAD-only volumes support matching DBZH observations without requiring DBZH in the velocity file', () => {
  const dbz = {...candidates[0], href:'dbz', doppler:false, products:['DBZH']};
  const vrad = {...dbz, href:'velocity-only', doppler:true, products:['VRADH']};
  expect(matchingVelocityScan([dbz,vrad],dbz)?.href).toBe('velocity-only');
});
test('nearby but different observation times and elevations are not relabelled as matching VRAD', () => {
  const dbz = candidates[0];
  expect(matchingVelocityScan([{...dbz,time:'2026-11-01T12:57:00Z'}],dbz)).toBeNull();
  expect(matchingVelocityScan([{...dbz,level:1.5}],dbz)).toBeNull();
  expect(matchingVelocityScan([dbz],dbz)?.href).toBe('volume');
});