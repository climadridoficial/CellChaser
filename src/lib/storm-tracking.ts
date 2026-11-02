import munkres from "munkres-js";
import { latitudeFromY, mercatorY, polarAt } from "./radar-geometry";
import type { RadarBounds } from "./aemet-overlay";
import type { StormAdvisory } from './storm-advisory';

export type Intensity = "light" | "strong" | "veryStrong" | "extreme";
export interface EchoGrid { values: Float32Array; width: number; height: number; bounds: RadarBounds }
export interface Cell { lat: number; lon: number; dbz: number; radiusKm: number }
export interface CellFrame { time: number; cells: Cell[] }
export interface TrackPoint extends Cell { time: number }
export interface StormTrack { id: string; points: TrackPoint[]; intensity: Intensity; forecast: [number, number][] | null; speedKmh: number; advisory?: StormAdvisory }

// Reflectivity classes, not a severe-weather classification or warning.
/** Smaller echoes (a few pixels) are treated as probable false echoes. */
export const MIN_RADIUS_KM = 3.5;
export function cellIntensity(dbz: number): Intensity {
  return dbz >= 60 ? "extreme" : dbz >= 50 ? "veryStrong" : dbz >= 40 ? "strong" : "light";
}

/** Spatially coherent >=25 dBZ regions; reject speckle and thin linework. */
export function detectCells(grid: EchoGrid): Cell[] {
  const { values, width, height, bounds: [[south, west], [north, east]] } = grid;
  const visited = new Uint8Array(width * height);
  const top = mercatorY(north), bottom = mercatorY(south);
  const pixelArea = Math.abs((east - west) * 111.32 * Math.cos((north + south) / 2 * Math.PI / 180) / width * (north - south) * 111.32 / height);
  const cells: Cell[] = [];
  for (let seed = 0; seed < values.length; seed++) {
    if (visited[seed] || !(Number(values[seed]) >= 25)) continue;
    const queue = [seed]; visited[seed] = 1;
    let sx = 0, sy = 0, weight = 0;
    const dbzs: number[] = [];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q]; if (i === undefined) continue;
      const x = i % width, y = Math.floor(i / width), dbz = Number(values[i]);
      const w = Math.max(1, dbz - 20); sx += (x + 0.5) * w; sy += (y + 0.5) * w; weight += w; dbzs.push(dbz);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, j = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || visited[j] || !(Number(values[j]) >= 25)) continue;
        visited[j] = 1; queue.push(j);
      }
    }
    if (dbzs.length < 6 || dbzs.length * pixelArea < Math.PI * MIN_RADIUS_KM ** 2) continue;
    const members = new Set(queue);
    // Solid >=35 dBZ core covering a real area (not a few hot pixels / diagonal dots).
    let corePixels = 0, solid = false;
    for (const i of queue) {
      if (!(Number(values[i]) >= 35)) continue;
      corePixels++;
      const x = i % width, y = Math.floor(i / width);
      if (!solid && x + 1 < width && y + 1 < height && [i, i + 1, i + width, i + width + 1].every(j => members.has(j) && Number(values[j]) >= 35)) solid = true;
    }
    if (!solid || corePixels * pixelArea < 3) continue;
    // Shape: reject thin lines/rays/rings (clutter, interference, outline leftovers).
    let minX = width, maxX = 0, minY = height, maxY = 0, mx = 0, my = 0;
    for (const i of queue) { const x = i % width, y = Math.floor(i / width); mx += x; my += y; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    mx /= queue.length; my /= queue.length;
    let cxx = 0, cyy = 0, cxy = 0;
    for (const i of queue) { const dx = i % width - mx, dy = Math.floor(i / width) - my; cxx += dx * dx; cyy += dy * dy; cxy += dx * dy; }
    const tr = cxx + cyy, det = cxx * cyy - cxy * cxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const elongation = Math.sqrt((tr / 2 + disc) / Math.max(1e-6, tr / 2 - disc));
    const fill = queue.length / ((maxX - minX + 1) * (maxY - minY + 1));
    if (elongation > 5 || fill < 0.15) continue;
    // Speckled/noisy texture: real storms have a large share of contiguous echo above 30 dBZ.
    if (dbzs.filter(v => v >= 30).length / dbzs.length < 0.25) continue;
    dbzs.sort((a, b) => a - b);
    cells.push({ lat: latitudeFromY(top - sy / weight / height * (top - bottom)), lon: west + sx / weight / width * (east - west), dbz: dbzs[Math.floor((dbzs.length - 1) * 0.9)] ?? 25, radiusKm: Math.sqrt(dbzs.length * pixelArea / Math.PI) });
  }
  return cells.sort((a, b) => b.dbz - a.dbz).slice(0, 60);
}

function displacement(a: Cell, b: Cell): [number, number] {
  return [(b.lon - a.lon) * 111.32 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180), (b.lat - a.lat) * 111.32];
}
function offset(cell: Cell, x: number, y: number): [number, number] {
  return [cell.lat + y / 111.32, cell.lon + x / (111.32 * Math.cos(cell.lat * Math.PI / 180))];
}

/** Rebuild chronologically so scrubbing never uses future observations. */
export function trackCells(frames: CellFrame[], radarId: string): StormTrack[] {
  const ordered = [...new Map(frames.map(f => [f.time, { ...f, cells: mergeCells(f.cells) }])).values()].sort((a, b) => a.time - b.time);
  let active: StormTrack[] = []; let serial = 0;
  for (const frame of ordered) {
    const previous = active.filter(t => { const p = t.points.at(-1); return p && frame.time > p.time && frame.time - p.time <= 20 * 60_000; });
    const used = new Set<number>(); const next: StormTrack[] = [];
    const costs = previous.map(t => {
      const p = t.points.at(-1);
      return [...frame.cells.map(c => {
        if (!p) return 1e6;
        const dt = (frame.time - p.time) / 3600_000;
        const distance = polarAt(c.lat, c.lon, p.lat, p.lon).distance / 1000;
        if (distance > 130 * dt + 3 || c.radiusKm / p.radiusKm > 4 || p.radiusKm / c.radiusKm > 4) return 1e6;
        const older = t.points.at(-2);
        let predicted: Cell = p;
        if (older) { const [x, y] = displacement(older, p); const scale = (frame.time - p.time) / (p.time - older.time); const [lat, lon] = offset(p, x * scale, y * scale); predicted = { ...p, lat, lon }; }
        return polarAt(c.lat, c.lon, predicted.lat, predicted.lon).distance / 1000 + Math.abs(c.dbz - p.dbz) * 0.08;
      }), ...previous.map(() => 130 * ((frame.time - (p?.time ?? frame.time)) / 3600_000) + 4)];
    });
    if (costs.length) for (const [row, col] of munkres(costs)) {
      const track = previous[row], cell = frame.cells[col];
      if (!track || !cell || Number(costs[row]?.[col]) >= 1e6) continue;
      used.add(col);
      next.push({ ...track, points: [...track.points, { ...cell, time: frame.time }], intensity: cellIntensity(cell.dbz), forecast: null });
    }
    frame.cells.forEach((cell, i) => { if (!used.has(i)) next.push({ id: `${radarId}-${frame.time}-${serial++}`, points: [{ ...cell, time: frame.time }], intensity: cellIntensity(cell.dbz), forecast: null, speedKmh: 0 }); });
    active = next;
  }
  // NWS-style 60-minute corridor: 30 minutes looked far too short against real cell motion.
  const FORECAST_HOURS = 1;
  return active.map(track => {
    // AEMET often re-serves the same image: identical repeated positions are stale frames, not a stopped storm.
    const distinct = track.points.filter((p, i, all) => i === 0 || p.lat !== all[i - 1]!.lat || p.lon !== all[i - 1]!.lon);
    const last = distinct.at(-1), recent = distinct.slice(-4), first = recent[0];
    if (!last || !first || recent.length < 3 || last.time <= first.time) return track;
    const before = recent.at(-2), older = recent.at(-3);
    if (!before || !older) return track;
    const [dx, dy] = displacement(before, last), hours = (last.time - before.time) / 3600_000;
    const [ox, oy] = displacement(older, before), oldHours = (before.time - older.time) / 3600_000;
    if (hours <= 0 || oldHours <= 0) return track;
    const latestSpeed = Math.hypot(dx, dy) / hours, oldSpeed = Math.hypot(ox, oy) / oldHours;
    // A single reversal/jump is not enough evidence for a new forecast.
    if (latestSpeed > 130 || oldSpeed > 130 || latestSpeed < 2 || oldSpeed < 2 || (dx * ox + dy * oy) < -0.25 * Math.hypot(dx, dy) * Math.hypot(ox, oy)) return track;
    // Emphasise the newest segment so the quadrilateral turns with the cell.
    const vx = 0.8 * dx / hours + 0.2 * ox / oldHours, vy = 0.8 * dy / hours + 0.2 * oy / oldHours, speed = Math.hypot(vx, vy);
    if (speed < 2 || speed > 130) return track;
    // A couple of speckle pixels are probably false echoes: no cone for them.
    if (last.radiusKm < MIN_RADIUS_KM) return track;
    const px = -vy / speed, py = vx / speed, width = Math.max(6, last.radiusKm), farWidth = width + 5 + speed * 0.05;
    const forecast = [offset(last, px * width, py * width), offset(last, -px * width, -py * width), offset(last, vx * FORECAST_HOURS - px * farWidth, vy * FORECAST_HOURS - py * farWidth), offset(last, vx * FORECAST_HOURS + px * farWidth, vy * FORECAST_HOURS + py * farWidth)];
    return { ...track, forecast, speedKmh: Math.round(speed) };
  });
}

/** A one-scan dot is unconfirmed; retain only repeated detections in real data. */
export function confirmedStormTracks(frames: CellFrame[], radarId: string): StormTrack[] {
  return dedupeTracks(trackCells(frames, radarId)).filter(track => track.points.length >= 3 && (track.points.at(-1)?.radiusKm ?? 0) >= MIN_RADIUS_KM);
}
/** Gap (km) between two echo edges below which they count as the same storm. */
export const MERGE_GAP_KM = 8;

/** Fuse fragments of one storm (touching or nearly touching cells) into one cell. */
export function mergeCells(cells: Cell[]): Cell[] {
  const groups: Cell[][] = [];
  const sorted = [...cells].sort((a, b) => b.radiusKm ** 2 * b.dbz - a.radiusKm ** 2 * a.dbz);
  for (const cell of sorted) {
    const group = groups.find(g => g.some(o => polarAt(cell.lat, cell.lon, o.lat, o.lon).distance / 1000 <= cell.radiusKm + o.radiusKm + MERGE_GAP_KM));
    if (group) group.push(cell); else groups.push([cell]);
  }
  return groups.map(g => {
    if (g.length === 1) return g[0]!;
    const area = g.reduce((s, c) => s + c.radiusKm ** 2, 0);
    // Match the detector's upper-decile statistic, weighted by fragment area.
    // Taking the maximum lets a tiny intense fragment colour the entire storm.
    let cumulativeArea = 0;
    let dbz = g[0]?.dbz ?? 25;
    for (const fragment of [...g].sort((a, b) => a.dbz - b.dbz)) {
      cumulativeArea += fragment.radiusKm ** 2;
      dbz = fragment.dbz;
      if (cumulativeArea >= area * 0.9) break;
    }
    return {
      lat: g.reduce((s, c) => s + c.lat * c.radiusKm ** 2, 0) / area,
      lon: g.reduce((s, c) => s + c.lon * c.radiusKm ** 2, 0) / area,
      dbz,
      radiusKm: Math.sqrt(area),
    };
  });
}

/** One cone per storm: drop tracks (e.g. from overlapping radars) sitting on a bigger one. */
export function dedupeTracks(tracks: StormTrack[]): StormTrack[] {
  const score = (t: StormTrack) => (t.forecast ? 1e6 : 0) + t.points.length * 1e3 + (t.points.at(-1)?.radiusKm ?? 0);
  const kept: StormTrack[] = [];
  for (const t of [...tracks].sort((a, b) => score(b) - score(a))) {
    const p = t.points.at(-1);
    if (!p) continue;
    if (kept.some(k => { const q = k.points.at(-1)!; return polarAt(p.lat, p.lon, q.lat, q.lon).distance / 1000 <= p.radiusKm + q.radiusKm + MERGE_GAP_KM; })) continue;
    kept.push(t);
  }
  return kept;
}
