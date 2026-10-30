import munkres from "munkres-js";
import { latitudeFromY, mercatorY, polarAt } from "./radar-geometry";
import type { RadarBounds } from "./aemet-overlay";

export type Intensity = "light" | "strong" | "veryStrong" | "extreme";
export interface EchoGrid { values: Float32Array; width: number; height: number; bounds: RadarBounds }
export interface Cell { lat: number; lon: number; dbz: number; radiusKm: number }
export interface CellFrame { time: number; cells: Cell[] }
export interface TrackPoint extends Cell { time: number }
export interface StormTrack { id: string; points: TrackPoint[]; intensity: Intensity; forecast: [number, number][] | null; speedKmh: number }

// Reflectivity classes, not a severe-weather classification or warning.
/** Smaller echoes (a few pixels) are treated as probable false echoes. */
export const MIN_RADIUS_KM = 2.5;
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
    // At least one solid 2x2 >=30 dBZ core, not a chain of diagonal dots.
    const core = queue.some(i => {
      const x = i % width, y = Math.floor(i / width);
      return x + 1 < width && y + 1 < height && [i, i + 1, i + width, i + width + 1].every(j => members.has(j) && Number(values[j]) >= 30);
    });
    if (!core) continue;
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
  const ordered = [...new Map(frames.map(f => [f.time, f])).values()].sort((a, b) => a.time - b.time);
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
  return active.map(track => {
    const last = track.points.at(-1), recent = track.points.slice(-4), first = recent[0];
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
    const forecast = [offset(last, px * width, py * width), offset(last, -px * width, -py * width), offset(last, vx * 0.5 - px * farWidth, vy * 0.5 - py * farWidth), offset(last, vx * 0.5 + px * farWidth, vy * 0.5 + py * farWidth)];
    return { ...track, forecast, speedKmh: Math.round(speed) };
  });
}

/** A one-scan dot is unconfirmed; retain only repeated detections in real data. */
export function confirmedStormTracks(frames: CellFrame[], radarId: string): StormTrack[] {
  return trackCells(frames, radarId).filter(track => track.points.length >= 2 && (track.points.at(-1)?.radiusKm ?? 0) >= MIN_RADIUS_KM);
}