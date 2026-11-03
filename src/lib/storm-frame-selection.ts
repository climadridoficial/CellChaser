import { radarFrameVisible } from './radar-freshness';
import { STORM_READ_VERSIONS } from './storm-version';

export interface SharedStormFrame {
  radar_id: string;
  source: string;
  observed_at: string;
  algorithm_version: number;
}

/** Version 4 has the same trajectory/intensity rules; only VRAD context changed in 5. */
export function selectStormFrame<T extends SharedStormFrame>(frames: T[], radarId: string, source: string, at: number | null, maxAge: number, now: number, unavailable: boolean): T | undefined {
  const visible = frames.filter(f => f.radar_id === radarId && f.source === source
    && radarFrameVisible(f.observed_at, at, maxAge, now, unavailable));
  for (const version of STORM_READ_VERSIONS) {
    const frame = visible.filter(f => f.algorithm_version === version)
      .sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at))[0];
    if (frame) return frame;
  }
  return undefined;
}