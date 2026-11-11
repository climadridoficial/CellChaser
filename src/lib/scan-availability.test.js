import { expect, test } from "bun:test";
import { measureRadarRanges, pickCompositeRadarScan, pickDefaultRadarScan, initialRadarSelection, individualRangeOptions, individualSharedCandidate, sharedIndividualScan, selectionCandidates, usableLevels, stationHasScans, matchingVelocityScan } from "./scan-availability";

const now = Date.parse("2026-11-01T13:07:00Z");
const maxAge = 20 * 60_000;
const candidates = [
  { href: "volume", time: "2026-11-01T13:00:00Z", level: 0.5, doppler: true, products: ["DBZH", "VRADH"] },
  { href: "volume", time: "2026-11-01T13:00:00Z", level: 1.5, doppler: true, products: ["DBZH", "VRADH"] },
  { href: "long", time: "2026-11-01T13:00:00Z", level: 2.1, doppler: false, products: ["DBZH"] },
  { href: "old", time: "2026-11-01T12:00:00Z", level: 4.5, doppler: true, products: ["DBZH"] },
];

for (const id of ["0-724-0-eslid", "0-724-0-essse"]) {
  test(`${id} defaults composite and individual to measured 240 km even above the 120 km tilt`, async () => {
    const volumes = await measureRadarRanges(id, [
      { ...candidates[0], href: "short", doppler: false },
      { ...candidates[2], href: "long", doppler: true },
    ], async href => href === "long" ? 240 : 120);
    expect(pickDefaultRadarScan(id, volumes, "DBZH", now, maxAge)?.href).toBe("long");
    expect(initialRadarSelection(volumes, "DBZH", null, maxAge, now, id)).toEqual({ level: 2.1, range: "long" });
    expect(selectionCandidates(volumes, "DBZH", "short", true)[0]?.href).toBe("short");
    expect(pickDefaultRadarScan(id, volumes, "DBZH", Date.parse(candidates[0].time), 600_000)?.href).toBe("long");
  });
  test(`${id} missing or expired long range never defaults to short`, () => {
    expect(pickDefaultRadarScan(id, [{...candidates[0], rangeKm: 120}], "DBZH", now, maxAge)).toBeNull();
    expect(pickDefaultRadarScan(id, [{...candidates[0], rangeKm: 240}], "DBZH", now + 3600_000, maxAge)).toBeNull();
  });
  test(`${id} opens the identical composite scan, not a newly selected/rendered file`, () => {
    const scan = { time: candidates[0].time, dataUrl: "blob:shared-radar", rangeKm: 120 };
    expect(sharedIndividualScan(id, scan, false, null, maxAge, now)).toBe(scan);
    expect(sharedIndividualScan(id, scan, true, null, maxAge, now)).toBeNull();
    expect(sharedIndividualScan(id, scan, false, null, maxAge, now + 3600_000)).toBeNull();
  });
}

for (const id of ["0-724-0-esmad", "0-724-0-esnjr", "0-724-0-esatn", "0-724-0-esbar"]) {
  test(`${id} reuses its own composite scan without new discovery, but manual changes and expired frames never reuse it`, () => {
    const scan = { time: candidates[0].time, dataUrl: `blob:${id}`, rangeKm: 240 };
    expect(sharedIndividualScan(id, scan, false, null, maxAge, now)).toBe(scan);
    expect(sharedIndividualScan(id, scan, true, null, maxAge, now)).toBeNull();
    expect(sharedIndividualScan(id, scan, false, null, maxAge, now + 3600_000)).toBeNull();
    expect(sharedIndividualScan(id, scan, false, Date.parse("2026-11-01T12:30:00Z"), maxAge, now)).toBeNull();
    expect(sharedIndividualScan(id, null, false, null, maxAge, now)).toBeNull();
  });
}

test("San Sebastián exposes long range even when discovery only returns short range", () => {
  expect(individualRangeOptions("0-724-0-essse", [candidates[0]], "DBZH")).toEqual(["short", "long"]);
});
test("Valladolid exposes long range even when scan discovery is empty", () => {
  expect(individualRangeOptions("0-724-0-eslid", [], "DBZH")).toEqual(["short", "long"]);
});
for (const station of ["Valladolid", "San Sebastián"]) {
  test(`${station} measured long range wins over inverted velocity classification`, () => {
    const volumes = [
      { ...candidates[0], href: "physical-long", rangeKm: 240 },
      { ...candidates[2], href: "physical-short", rangeKm: 120 },
    ];
    expect(selectionCandidates(volumes, "DBZH", "long", true).map(c => c.href)).toEqual(["physical-long"]);
    expect(selectionCandidates(volumes, "DBZH", "short", true).map(c => c.href)).toEqual(["physical-short"]);
    expect(initialRadarSelection(volumes, "DBZH", null, maxAge, now)?.range).toBe("long");
  });
}
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