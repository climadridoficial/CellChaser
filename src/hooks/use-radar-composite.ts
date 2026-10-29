import { useQueries } from "@tanstack/react-query";
import type { RadarStation } from "@/lib/ord";
import { fetchScanHistory, pickScan } from "@/lib/ord";
import { decodeAndRender } from "@/lib/odim";
import { aemetCodeFor } from "@/lib/aemet-radars";
import { AEMET_REFRESH_MS, loadAemetImages, processAemetImage, type RadarBounds } from "@/lib/aemet-overlay";
import { AEMET_CALIBRATION } from "@/lib/aemet-calibration";
import { aemetFrameFor, fetchAemetFrameUrl, useAemetFrames } from "@/lib/aemet-history";
import { AEMET_LIVE_MAX_AGE_MS, compositeSource, OPERA_MAX_AGE_MS, type CompositeMode, type OperaState } from "@/lib/composite";
import { HISTORY_HOURS, STEP_MS } from "@/lib/timeline";
import { radarFrameVisible } from "@/lib/radar-freshness";
import { useRadarNow } from "@/hooks/use-radar-now";

export interface CompositeLayer {
  key: string;
  /** RadarStation.id this image belongs to. */
  radarId: string;
  source: "opera" | "aemet";
  image: string;
  bounds: RadarBounds;
  observedAt: string;
}

const REFRESH_MS = 60_000;
// Lighter than the station panel's full-detail render: 10 radars at once.
const COMPOSITE_SIZE = 1000;

/**
 * Spanish radars (OPERA + AEMET-only) drawn together on the map, at time `at`
 * (null = live). Only a matching, fresh frame can remain visible.
 */
export function useRadarComposite(mode: CompositeMode, radars: RadarStation[], apiKey: string, at: number | null) {
  const now = useRadarNow();
  const wantOpera = mode === "opera" || mode === "opera-fallback";

  // One request per radar lists every scan in the slider window.
  const history = useQueries({
    queries: radars.map((s) => ({
      queryKey: ["opera-history", s.id, apiKey],
      enabled: !s.offline && wantOpera,
      staleTime: REFRESH_MS,
      refetchInterval: REFRESH_MS,
      retry: 1,
      queryFn: () => fetchScanHistory(s.id, "DBZH", HISTORY_HOURS + 0.5, apiKey || undefined),
    })),
  });

  const picks = radars.map((_, i) => {
    const list = history[i]?.data;
    if (!list) return undefined;
    return at === null ? pickScan(list, now, OPERA_MAX_AGE_MS) : pickScan(list, at, STEP_MS);
  });

  const scans = useQueries({
    queries: radars.map((s, i) => {
      const pick = picks[i];
      return {
        queryKey: ["composite-opera-scan", pick?.href ?? null],
        enabled: !!pick,
        staleTime: Infinity,
        gcTime: 30 * 60_000,
        retry: 1,
        queryFn: async () => {
          if (!pick) throw new Error("No OPERA scan");
          const scan = await decodeAndRender({
            href: pick.href,
            product: "DBZH",
            level: pick.level,
            time: pick.time,
            fallbackStation: { lat: s.lat, lon: s.lon },
            size: COMPOSITE_SIZE,
          });
          return { image: scan.dataUrl, bounds: scan.bounds as RadarBounds, time: pick.time };
        },
      };
    }),
  });

  const operaStates: OperaState[] = radars.map((s, i) => {
    if (s.offline) return null;
    const h = history[i];
    if (!h || h.isPending) return h?.isError ? "missing" : "loading";
    if (h.isError || picks[i] === null) return "missing";
    const q = scans[i];
    if (q?.isError) return "missing";
    if (q?.data && radarFrameVisible(q.data.time, at, OPERA_MAX_AGE_MS, now)) return "ok";
    return "loading";
  });

  const aemetCodes = radars.map((s) => {
    const code = aemetCodeFor(s);
    return code && AEMET_CALIBRATION[code] ? code : null;
  });
  const wantAemet = radars.map((_, i) => compositeSource(mode, !!aemetCodes[i], operaStates[i] ?? null) === "aemet");

  const frames = useAemetFrames(at !== null && wantAemet.some(Boolean));
  const aemetFrames = radars.map((_, i) =>
    at !== null && aemetCodes[i] ? aemetFrameFor(frames.data, aemetCodes[i] ?? "", at) : null,
  );

  const aemet = useQueries({
    queries: radars.map((_, i) => {
      const code = aemetCodes[i];
      const frame = aemetFrames[i];
      const live = at === null;
      return {
        queryKey: live ? ["composite-aemet", code] : ["composite-aemet-frame", code, frame?.observedAt ?? null],
        enabled: !!wantAemet[i] && (live || !!frame),
        staleTime: live ? AEMET_REFRESH_MS : Infinity,
        refetchInterval: live ? AEMET_REFRESH_MS : (false as const),
        gcTime: 30 * 60_000,
        retry: 2,
        queryFn: async (): Promise<{ echoes: string; observedAt: string | null }> => {
          if (!code) throw new Error("No AEMET radar");
          if (live) {
            const images = await loadAemetImages(code, Math.floor(Date.now() / AEMET_REFRESH_MS));
            return { echoes: images.echoes, observedAt: images.observedAt };
          }
          if (!frame) throw new Error("No archived frame");
          const images = await processAemetImage(code, await fetchAemetFrameUrl(frame));
          return { echoes: images.echoes, observedAt: frame.observedAt };
        },
      };
    }),
  });

  const layers = (() => {
    const out: CompositeLayer[] = [];
    radars.forEach((s, i) => {
      const source = compositeSource(mode, !!aemetCodes[i], operaStates[i] ?? null);
      if (source === "opera") {
        const d = scans[i]?.data;
        if (d && picks[i] && radarFrameVisible(d.time, at, OPERA_MAX_AGE_MS, now, scans[i]?.isError || history[i]?.isError)) out.push({ key: `opera-${s.id}-${d.time}`, radarId: s.id, source, image: d.image, bounds: d.bounds, observedAt: d.time });
      } else if (source === "aemet") {
        const d = aemet[i]?.data;
        const code = aemetCodes[i];
        if (!d || !code) return;
        const bounds = AEMET_CALIBRATION[code];
        if (!bounds) return;
        // Live: AEMET keeps serving the last image of a broken radar for days.
        if (!radarFrameVisible(d.observedAt, at, AEMET_LIVE_MAX_AGE_MS, now, aemet[i]?.isError)) return;
        // History: nothing archived for this moment.
        if (at !== null && !aemetFrames[i]) return;
        out.push({
          key: `aemet-${code}-${d.observedAt ?? aemet[i]?.dataUpdatedAt}-${d.echoes.length}`,
          radarId: s.id,
          source,
          image: d.echoes,
          bounds,
          observedAt: d.observedAt ?? "",
        });
      }
    });
    return out;
  })();

  const loading =
    history.some((q) => q.isFetching) ||
    scans.some((q, i) => q.isFetching || (!!picks[i] && q.isPlaceholderData)) ||
    aemet.some((q, i) => q.isFetching || (wantAemet[i] && (at === null || !!aemetFrames[i]) && q.isPlaceholderData)) ||
    frames.isFetching;
  const counts = {
    opera: layers.filter((l) => l.source === "opera").length,
    aemet: layers.filter((l) => l.source === "aemet").length,
  };
  return { layers, loading, counts };
}
