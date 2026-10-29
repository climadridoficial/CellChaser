import { test, expect } from "bun:test";
import { demoTracks, DEMO_DBZ } from "./storm-demo";

test("temporary demo shows every intensity then weakens, adding one dot per simulated scan", () => {
  expect([demoTracks(1)[0].intensity, demoTracks(2)[0].intensity, demoTracks(4)[0].intensity, demoTracks(5)[0].intensity, demoTracks(9)[0].intensity]).toEqual(["light", "strong", "veryStrong", "extreme", "light"]);
  expect(demoTracks(9)[0].points).toHaveLength(DEMO_DBZ.length);
  expect(demoTracks(1)[0].forecast).toHaveLength(4);
  expect(demoTracks(0)[0].forecast).toBeNull();
});