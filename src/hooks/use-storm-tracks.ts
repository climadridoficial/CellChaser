import { useQueries, useQueryClient } from "@tanstack/react-query";
import { fetchScanHistory, pickScan, type RadarStation } from "@/lib/ord";
import { decodeAndRender, type RenderedScan } from "@/lib/odim";
import { fetchAemetFrameUrl, useAemetFrames } from "@/lib/aemet-history";
import { processAemetImage } from "@/lib/aemet-overlay";
import { aemetCodeFor } from "@/lib/aemet-radars";
import { aemetEchoGrid } from "@/lib/storm-images";
import { detectCells, trackCells, type CellFrame } from "@/lib/storm-tracking";
import type { CompositeLayer } from "./use-radar-composite";

// Limit binary downloads/decodes across all radar sequences.
let running = 0;
const waiting: (() => void)[] = [];
async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>(resolve => waiting.push(resolve));
  else running++;
  try { return await work(); }
  finally { const next = waiting.shift(); if (next) next(); else running--; }
}

export function useStormTracks(enabled: boolean, layers: CompositeLayer[], scan: RenderedScan | null, selectedId: string | null, stations: RadarStation[], apiKey: string) {
  const client = useQueryClient();
  const targets: CompositeLayer[] = scan && selectedId
    ? scan.product === "DBZH" ? [{ key: `storm-${selectedId}-${scan.time}`, radarId: selectedId, source: "opera", image: scan.dataUrl, bounds: scan.bounds, observedAt: scan.time }] : []
    : layers;
  const archive = useAemetFrames(enabled && targets.some(l => l.source === "aemet"));
  const queries = useQueries({ queries: targets.map(layer => ({
    queryKey: ["storm-sequence", layer.radarId, layer.source, layer.observedAt, apiKey, layer.source === "aemet" ? archive.dataUpdatedAt : 0],
    enabled: enabled && Number.isFinite(Date.parse(layer.observedAt)) && (layer.source !== "aemet" || !!archive.data),
    staleTime: Infinity,
    gcTime: 15 * 60_000,
    retry: 1,
    queryFn: async () => {
      const end = Date.parse(layer.observedAt), start = end - 60 * 60_000;
      const station = stations.find(s => s.id === layer.radarId);
      if (!station) throw new Error("No radar station");
      const frames: CellFrame[] = [];
      let missing = 0;
      if (layer.source === "aemet") {
        const code = aemetCodeFor(station); if (!code) throw new Error("No AEMET code");
        const available = (archive.data ?? []).filter(f => f.code === code && f.time >= start && f.time < end);
        for (const frame of available) {
          try {
            frames.push(await client.ensureQueryData({ queryKey: ["storm-cells-aemet", code, frame.observedAt], staleTime: Infinity, gcTime: 15 * 60_000, queryFn: () => limited(async () => {
              const images = await processAemetImage(code, await fetchAemetFrameUrl(frame));
              return { time: frame.time, cells: detectCells(await aemetEchoGrid(images.echoes, layer.bounds)) };
            }) }));
          } catch { missing++; }
        }
        frames.push({ time: end, cells: detectCells(await aemetEchoGrid(layer.image, layer.bounds)) });
      } else {
        const history = await client.ensureQueryData({ queryKey: ["opera-history", station.id, apiKey], staleTime: 60_000, queryFn: () => fetchScanHistory(station.id, "DBZH", 6.5, apiKey || undefined) });
        const times = [...new Set(history.map(f => Date.parse(f.time)))].filter(t => t >= start && t <= end).sort((a, b) => a - b);
        for (const time of times) {
          const pick = pickScan(history.filter(f => Date.parse(f.time) === time), time, 60_000);
          if (!pick) continue;
          try {
            frames.push(await client.ensureQueryData({ queryKey: ["storm-cells-opera", pick.href, pick.level], staleTime: Infinity, gcTime: 15 * 60_000, queryFn: () => limited(async () => {
              const decoded = scan?.time === pick.time && scan.echoGrid ? scan : await decodeAndRender({ ...pick, product: "DBZH", fallbackStation: station, size: 240 });
              if (!decoded.echoGrid) throw new Error("No reflectivity grid");
              return { time, cells: detectCells(decoded.echoGrid) };
            }) }));
          } catch { missing++; }
        }
        // Never carry a forecast from a failed or missing current scan.
        if (frames.at(-1)?.time !== end) return { tracks: [], missing: missing + 1 };
      }
      return { tracks: trackCells(frames, `${layer.source}-${layer.radarId}`), missing };
    },
  })) });
  return {
    tracks: enabled ? queries.flatMap(q => q.data?.tracks ?? []) : [],
    loading: enabled && (archive.isFetching || queries.some(q => q.isFetching)),
    incomplete: queries.some(q => q.isError || (q.data?.missing ?? 0) > 0) || archive.isError,
    supported: targets.length > 0,
  };
}