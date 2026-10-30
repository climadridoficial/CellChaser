import { expect, test } from "bun:test";
import { cellIntensity, detectCells, trackCells, confirmedStormTracks } from "./storm-tracking";
import { aemetDbz } from "./storm-images";

const t0 = Date.parse("2026-10-29T17:00:00Z");
const cell = (lon, dbz = 35) => ({ lat: 40, lon, dbz, radiusKm: 3 });
const frame = (minutes, lon, dbz) => ({ time: t0 + minutes * 60_000, cells: [cell(lon, dbz)] });

test("forecast intensities are green/light, yellow/strong, red/very strong and magenta/extreme", () => {
  expect([cellIntensity(39.9), cellIntensity(40), cellIntensity(50), cellIntensity(60)]).toEqual(["light", "strong", "veryStrong", "extreme"]);
});
test("one dot per scan and colour recalculates when a storm strengthens then weakens", () => {
  const frames = [frame(0, -3, 35), frame(10, -2.92, 55), frame(20, -2.84, 65), frame(30, -2.76, 32)];
  expect(trackCells(frames.slice(0, 2), "radar")[0].intensity).toBe("veryStrong");
  expect(trackCells(frames.slice(0, 3), "radar")[0].intensity).toBe("extreme");
  const track = trackCells(frames, "radar")[0];
  expect(track.intensity).toBe("light");
  expect(track.points.map(p => p.time)).toEqual(frames.map(f => f.time));
  expect(track.forecast).toHaveLength(4);
  expect(track.forecast[2][1]).toBeGreaterThan(-2.76);
});
test("forecast is a 30 minute widening corridor using actual scan time deltas", () => {
  const track = trackCells([frame(0, -3, 45), frame(5, -2.96, 45), frame(15, -2.88, 45)], "radar")[0];
  expect(track.speedKmh).toBe(41);
  const farLon = (track.forecast[2][1] + track.forecast[3][1]) / 2;
  expect(farLon).toBeCloseTo(-2.64, 3);
});
test("single scans, stationary cells and gaps do not invent a path", () => {
  expect(trackCells([frame(0, -3, 40)], "radar")[0].forecast).toBeNull();
  expect(trackCells([frame(0, -3, 40), frame(10, -3, 40)], "radar")[0].forecast).toBeNull();
  const tracks = trackCells([frame(0, -3, 40), frame(30, -2.9, 40)], "radar");
  expect(tracks[0].points).toHaveLength(1);
  expect(tracks[0].forecast).toBeNull();
});
test("duplicate scans, out-of-order scans and disappearance preserve chronological identity", () => {
  const a = frame(0, -3, 40), b = frame(10, -2.92, 45);
  expect(trackCells([b, a, b], "radar")[0].points).toHaveLength(2);
  expect(trackCells([a, b, { time: t0 + 20 * 60_000, cells: [] }], "radar")).toEqual([]);
});
test("unphysical jumps start a new cell without false motion", () => {
  const track = trackCells([frame(0, -3, 40), frame(10, 1, 40)], "radar")[0];
  expect(track.points).toHaveLength(1);
});
test("detection ignores missing data and isolated clutter and retains cell intensity", () => {
  const values = new Float32Array(100).fill(NaN);
  values[0] = 70;
  for (const i of [43,44,45,53,54,55]) values[i] = 55;
  const cells = detectCells({ values, width: 10, height: 10, bounds: [[39,-4],[41,-2]] });
  expect(cells).toHaveLength(1);
  expect(cells[0].dbz).toBe(55);
  expect(cells[0].lon).toBeCloseTo(-3.1, 3);
  expect(cells[0].lat).toBeGreaterThan(39);
  expect(cells[0].lat).toBeLessThan(41);
});
test("AEMET categories use real GIF legend and exclude transparent or unknown pixels", () => {
  expect(aemetDbz(255,255,0,255)).toBe(48);
  expect(aemetDbz(255,0,0,255)).toBe(66);
  expect(aemetDbz(255,0,0,0)).toBeNaN();
  expect(aemetDbz(255,255,255,255)).toBeNaN();
});

test("thin linework and scattered dots are not storm cells", () => {
  const values = new Float32Array(400).fill(NaN);
  for (let i = 0; i < 20; i++) values[i * 21] = 60;
  expect(detectCells({ values, width: 20, height: 20, bounds: [[39,-4],[41,-2]] })).toEqual([]);
});
test("real tracks suppress single-scan echoes and forecasts wait for three scans", () => {
  expect(confirmedStormTracks([frame(0,-3,50)], "radar")).toEqual([]);
  expect(confirmedStormTracks([frame(0,-3,50),frame(10,-2.92,50)], "radar")[0].forecast).toBeNull();
});
test("forecast turns south with the latest measured storm motion", () => {
  const frames = [frame(0,-3,50),frame(10,-2.92,50), { time:t0+20*60_000, cells:[{...cell(-2.92,50),lat:39.92}] }];
  const track = trackCells(frames,"radar")[0];
  expect(track.forecast).toHaveLength(4);
  const farLat = (track.forecast[2][0]+track.forecast[3][0])/2;
  expect(farLat).toBeLessThan(39.92);
});
test("unconfirmed direction reversal does not create a misleading forecast", () => {
  expect(trackCells([frame(0,-3,50),frame(10,-2.92,50),frame(20,-3,50)],"radar")[0].forecast).toBeNull();
});
test("forecast cones have exactly four convex corners and widen in every direction", () => {
  for (const [dx, dy] of [[0.08,0],[-0.08,0],[0,0.08],[0,-0.08],[0.06,0.06],[-0.06,-0.06]]) {
    const frames = [0,1,2].map(i => ({time:t0+i*10*60_000,cells:[{...cell(-3+i*dx,50),lat:40+i*dy}]}));
    const cone = trackCells(frames,"radar")[0].forecast;
    expect(cone).toHaveLength(4);
    const cross = cone.map((p,i) => {
      const q=cone[(i+1)%4], r=cone[(i+2)%4];
      return (q[1]-p[1])*(r[0]-q[0])-(q[0]-p[0])*(r[1]-q[1]);
    });
    expect(cross.every(v=>v>0)||cross.every(v=>v<0)).toBe(true);
    const span=(a,b)=>Math.hypot(a[0]-b[0],(a[1]-b[1])*Math.cos(40*Math.PI/180));
    expect(span(cone[2],cone[3])).toBeGreaterThan(span(cone[0],cone[1]));
  }
});
test("speckle-sized cells get no cone and small cells get a minimum-size cone", () => {
  const tiny = (minutes, lon) => ({ time: t0 + minutes * 60_000, cells: [{ lat: 40, lon, dbz: 45, radiusKm: 1 }] });
  expect(trackCells([tiny(0, -3), tiny(10, -2.92), tiny(20, -2.84)], "radar")[0].forecast).toBeNull();
  const track = trackCells([frame(0, -3, 45), frame(10, -2.92, 45), frame(20, -2.84, 45)], "radar")[0];
  const nearKm = Math.hypot((track.forecast[0][0] - track.forecast[1][0]) * 111.32, (track.forecast[0][1] - track.forecast[1][1]) * 111.32 * Math.cos(40 * Math.PI / 180));
  expect(nearKm).toBeGreaterThanOrEqual(11.9);
});
