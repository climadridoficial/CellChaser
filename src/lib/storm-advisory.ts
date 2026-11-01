import { mercatorY, polarAt } from './radar-geometry';
import { quadFraction } from './lightning-inspector';
import type { LightningPeriod } from './lightning-period';
import type { Cell, EchoGrid, StormTrack } from './storm-tracking';
import type { Corners } from './aemet-overlay';

export interface VelocityEvidence {
  grid: EchoGrid;
  time: number;
  level: number;
  quantity: string;
}
export interface LightningEvidence {
  period: LightningPeriod;
  // Recognized newest-bin image pixels, not individual strike records.
  pixels: [number, number][];
  corners: Corners;
  width: number;
  height: number;
}
export interface StormAdvisory {
  version: 1;
  observedAt: number;
  source: 'opera' | 'aemet';
  vrad: { status: 'available' | 'unavailable' | 'outOfRange' | 'insufficient'; coverage: number; medianMs?: number; quantity?: string };
  lightning: { status: 'nearby' | 'notDetected' | 'unknown'; interval?: LightningPeriod };
}

/** Coverage within the observed cell; radial air motion NEVER replaces cell translation. */
export function velocityForCell(cell: Cell, time: number, level: number, velocity?: VelocityEvidence | null): StormAdvisory['vrad'] {
  if (!velocity || velocity.time !== time || Math.abs(velocity.level - level) > 0.01) return { status: 'unavailable', coverage: 0 };
  const { grid } = velocity;
  const [[south, west], [north, east]] = grid.bounds;
  const inside = cell.lat >= south && cell.lat <= north && cell.lon >= west && cell.lon <= east;
  if (!inside) return { status: 'outOfRange', coverage: 0 };
  const top = mercatorY(north), bottom = mercatorY(south);
  const values: number[] = [];
  let eligible = 0;
  // Sample a stable disk in geographic coordinates so grids of different range
  // use the same denominator, including missing gates and grid-edge gaps.
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    if (x*x + y*y > 36) continue;
    eligible++;
    const lat = cell.lat + y / 6 * cell.radiusKm / 111.32;
    const lon = cell.lon + x / 6 * cell.radiusKm / (111.32 * Math.cos(cell.lat * Math.PI / 180));
    const gx = Math.floor((lon - west) / (east - west) * grid.width);
    const gy = Math.floor((top - mercatorY(lat)) / (top - bottom) * grid.height);
    if (gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height) continue;
    const v = grid.values[gy * grid.width + gx];
    if (v !== undefined && Number.isFinite(v)) values.push(v);
  }
  const coverage = Math.round(values.length / eligible * 100);
  if (values.length < 12 || coverage < 50) return { status: 'insufficient', coverage };
  values.sort((a,b)=>a-b);
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : ((values[mid-1] ?? 0) + (values[mid] ?? 0)) / 2;
  return { status: 'available', coverage, medianMs: Math.round((median ?? 0)*10)/10, quantity: velocity.quantity };
}

/** Coarse image evidence only: no counts, polarity or minute-level strike times. */
export function lightningForCell(cell: Cell, time: number, evidence?: LightningEvidence | null): StormAdvisory['lightning'] {
  if (!evidence || evidence.period.end - evidence.period.start !== 12*3600_000 || evidence.period.end > time || time - evidence.period.end > 2*3600_000) return { status: 'unknown' };
  const corners = evidence.corners.map(([lat,lon])=>[lon,-mercatorY(lat)] as [number,number]);
  const centre = quadFraction([cell.lon,-mercatorY(cell.lat)],corners,evidence.width,evidence.height);
  if (!centre) return { status: 'unknown' };
  // Match only within the observed approximate cell disk, not its future cone.
  let nearby = false;
  for (let y=-6;y<=6 && !nearby;y++) for (let x=-6;x<=6 && !nearby;x++) {
    if (x*x+y*y>36) continue;
    const lat = cell.lat+y/6*cell.radiusKm/111.32;
    const lon = cell.lon+x/6*cell.radiusKm/(111.32*Math.cos(cell.lat*Math.PI/180));
    if (polarAt(lat,lon,cell.lat,cell.lon).distance > cell.radiusKm*1000+1) continue;
    const uv = quadFraction([lon,-mercatorY(lat)],corners,evidence.width,evidence.height);
    if (!uv) continue;
    const px=uv[0]*evidence.width, py=uv[1]*evidence.height;
    // Two source pixels allow for marker size/calibration; this isn't exact geolocation.
    nearby=evidence.pixels.some(([sx,sy])=>Math.abs(sx-px)<=2 && Math.abs(sy-py)<=2);
  }
  return { status: nearby?'nearby':'notDetected', interval: { start:evidence.period.end-2*3600_000,end:evidence.period.end } };
}

export function buildStormAdvisory(track: StormTrack, source: 'opera'|'aemet', level: number, velocity?: VelocityEvidence|null, lightning?: LightningEvidence|null): StormAdvisory | undefined {
  const last=track.points.at(-1);
  if (!last) return undefined;
  return {version:1,observedAt:last.time,source,vrad:velocityForCell(last,last.time,level,velocity),lightning:lightningForCell(last,last.time,lightning)};
}