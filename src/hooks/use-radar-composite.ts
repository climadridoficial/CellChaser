import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { NO_PRELOAD, runPool, type PreloadProgress } from "@/lib/preload";
import type { RadarStation, ScanCandidate } from "@/lib/ord";
import { fetchScanHistory, pickScan } from "@/lib/ord";
import { decodeAndRender, readScanRange, type RenderedScan } from "@/lib/odim";
import { measureRadarRanges, pickCompositeRadarScan, stationHasScans } from "@/lib/scan-availability";
import { aemetCodeFor } from "@/lib/aemet-radars";
import { AEMET_REFRESH_MS, loadAemetImages, processAemetImage, type RadarBounds } from "@/lib/aemet-overlay";
import { AEMET_CALIBRATION, AEMET_CORNERS } from "@/lib/aemet-calibration";
import { aemetFrameFor, fetchAemetFrameUrl, useAemetFrames, type AemetFrame } from "@/lib/aemet-history";
import { AEMET_LIVE_MAX_AGE_MS, compositeSource, OPERA_MAX_AGE_MS, type CompositeMode, type OperaState } from "@/lib/composite";
import { HISTORY_HOURS, slotAt, slotIndex, STEPS, STEP_MS } from "@/lib/timeline";
import { radarFrameVisible } from "@/lib/radar-freshness";
import { useRadarNow } from "@/hooks/use-radar-now";
import { OPERA_POLL_OPTIONS } from "@/lib/opera-refresh";
import { compositeRenderKey, compositeRenderSize } from "@/lib/radar-render-policy";

export interface CompositeLayer {
  key: string;
  /** RadarStation.id this image belongs to. */
  radarId: string;
  source: "opera" | "aemet";
  image: string;
  bounds: RadarBounds;
  observedAt: string;
  scan?: RenderedScan;
  candidate?: ScanCandidate;
}

const KEEP_MS = 2 * 3600_000;

type Pick = NonNullable<ReturnType<typeof pickScan>>;

function operaScanQuery(s: RadarStation, pick: Pick) {
  return {
    queryKey: compositeRenderKey(s, pick),
    queryFn: async () => {
      const scan = await decodeAndRender({
        href: pick.href,
        product: "DBZH",
        level: pick.level,
        time: pick.time,
        fallbackStation: { lat: s.lat, lon: s.lon },
        size: compositeRenderSize(s.id),
      });
      return { image: scan.dataUrl, bounds: scan.bounds as RadarBounds, time: pick.time, scan, candidate: pick };
    },
  };
}

function aemetFrameQuery(code: string, frame: AemetFrame) {
  return {
    queryKey: ["composite-aemet-frame", code, frame.observedAt, "warp1"] as const,
    queryFn: async (): Promise<{ echoes: string; observedAt: string | null }> => {
      const images = await processAemetImage(code, await fetchAemetFrameUrl(frame), AEMET_CORNERS[code]);
      return { echoes: images.echoes, observedAt: frame.observedAt };
    },
  };
}

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
      enabled: mode !== "off" && !s.offline && (wantOpera || !aemetCodeFor(s)),
      ...OPERA_POLL_OPTIONS,
      queryFn: async () => measureRadarRanges(s.id, await fetchScanHistory(s.id, "*", HISTORY_HOURS + 0.5, apiKey || undefined), readScanRange),
    })),
  });

  const picks = radars.map((s, i) => {
    const list = history[i]?.data?.filter(c => c.products?.includes("DBZH"));
    if (!list) return undefined;
    return pickCompositeRadarScan(list, "DBZH", at ?? now, at === null ? OPERA_MAX_AGE_MS : STEP_MS);
  });

  const scans = useQueries({
    queries: radars.map((s, i) => {
      const pick = picks[i];
      return {
        queryKey: compositeRenderKey(s, pick),
        enabled: !!pick,
        staleTime: Infinity,
        gcTime: KEEP_MS,
        retry: 1,
        queryFn: async () => {
          if (!pick) throw new Error("No OPERA scan");
          return operaScanQuery(s, pick).queryFn();
        },
      };
    }),
  });

  const operaStates: OperaState[] = radars.map((s, i) => {
    if (s.offline) return null;
    const h = history[i];
    const q = scans[i];
    if (q?.data && radarFrameVisible(q.data.time, at, OPERA_MAX_AGE_MS, now)) return "ok";
    if (h?.isError || q?.isError) return "error";
    if (!h || h.isPending) return "loading";
    if (picks[i] === null) return stationHasScans(h.data ?? [], at, OPERA_MAX_AGE_MS, now) ? "error" : "missing";
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
        queryKey: live ? ["composite-aemet", code, "warp1"] : ["composite-aemet-frame", code, frame?.observedAt ?? null, "warp1"],
        enabled: !!wantAemet[i] && (live || !!frame),
        staleTime: live ? AEMET_REFRESH_MS : Infinity,
        refetchInterval: live ? AEMET_REFRESH_MS : (false as const),
        gcTime: KEEP_MS,
        retry: 2,
        queryFn: async (): Promise<{ echoes: string; observedAt: string | null }> => {
          if (!code) throw new Error("No AEMET radar");
          if (live) {
            const images = await loadAemetImages(code, Math.floor(Date.now() / AEMET_REFRESH_MS), AEMET_CORNERS[code]);
            return { echoes: images.echoes, observedAt: images.observedAt };
          }
          if (!frame) throw new Error("No archived frame");
          return aemetFrameQuery(code, frame).queryFn();
        },
      };
    }),
  });

  // Keep each radar's previous image until its next one is ready (no flashing).
  const lastRef = useRef(new Map<string, CompositeLayer>());
  const pendingFor = (i: number, source: "opera" | "aemet" | null) => {
    if (source === "opera") return !!picks[i] && !scans[i]?.data && !scans[i]?.isError;
    if (source === "aemet") return (at === null || !!aemetFrames[i]) && !aemet[i]?.data && !aemet[i]?.isError;
    return operaStates[i] === "loading";
  };

  const layers = (() => {
    const out: CompositeLayer[] = [];
    radars.forEach((s, i) => {
      const before = out.length;
      layerFor(s, i);
      const last = lastRef.current.get(s.id);
      const added = out[out.length - 1];
      if (out.length > before && added) lastRef.current.set(s.id, added);
      else if (last && radarFrameVisible(last.observedAt, at, last.source === "opera" ? OPERA_MAX_AGE_MS : AEMET_LIVE_MAX_AGE_MS, now)
        && (pendingFor(i, compositeSource(mode, !!aemetCodes[i], operaStates[i] ?? null))
          || (last.source === "opera" && wantOpera && operaStates[i] === "error"))) out.push(last);
      else lastRef.current.delete(s.id);
    });
    return out;

    function layerFor(s: RadarStation, i: number) {
      const source = compositeSource(mode, !!aemetCodes[i], operaStates[i] ?? null);
      if (source === "opera") {
        const d = scans[i]?.data;
        if (d && radarFrameVisible(d.time, at, OPERA_MAX_AGE_MS, now)) out.push({ key: `opera-${s.id}-${d.time}-${d.candidate.href}-${d.candidate.level}-detail-v2`, radarId: s.id, source, image: d.image, bounds: d.bounds, observedAt: d.time, scan: d.scan, candidate: d.candidate });
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
    }
  })();

  // History mode: decode every slot once so sliding/playback is instant.
  const qc = useQueryClient();
  const historyMode = at !== null;
  const startSlot = slotIndex(at, Date.now());
  const tasks = useMemo(() => {
    if (!historyMode || mode === "off") return [];
    if (history.some((q, i) => q.isPending && !radars[i]?.offline && (wantOpera || !aemetCodes[i]))) return [];
    const base = Date.now();
    const seen = new Map<string, () => Promise<unknown>>();
    // Only the slider position onwards (towards live), nearest first.
    for (let slot = startSlot; slot < STEPS; slot++) {
      const t = slotAt(slot, base)!;
      radars.forEach((s, i) => {
        const list = history[i]?.data;
        const pick = list ? pickCompositeRadarScan(list, "DBZH", t, STEP_MS) : null;
        const code = aemetCodes[i];
        const useAemet = !!code && (mode === "opendata" || (mode === "opera-fallback" && (s.offline || (!!list && !history[i]?.isError && !stationHasScans(list, t, OPERA_MAX_AGE_MS, base)))));
        const useOpera = !useAemet && mode !== "opendata" ? true : !code && mode === "opendata";
        if (useAemet && code) {
          const frame = aemetFrameFor(frames.data, code, t);
          if (!frame) return;
          const q = aemetFrameQuery(code, frame);
          seen.set(JSON.stringify(q.queryKey), () => qc.prefetchQuery({ ...q, staleTime: Infinity, gcTime: KEEP_MS }));
        } else if (useOpera && pick) {
          const q = operaScanQuery(s, pick);
          seen.set(JSON.stringify(q.queryKey), () => qc.prefetchQuery({ ...q, staleTime: Infinity, gcTime: KEEP_MS }));
        }
      });
    }
    return [...seen.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyMode, startSlot, mode, radars, frames.data, history.map((q) => q.dataUpdatedAt).join(","), history.map((q) => q.isPending).join(",")]);

  const [preload, setPreload] = useState<PreloadProgress>(NO_PRELOAD);
  const planKey = tasks.map(([k]) => k).join("|");
  useEffect(() => {
    if (!tasks.length) {
      setPreload(NO_PRELOAD);
      return;
    }
    let cancelled = false;
    let done = 0;
    const todo = tasks.filter(([k]) => {
      const cached = qc.getQueryData(JSON.parse(k));
      if (cached) done++;
      return !cached;
    });
    setPreload({ done, total: tasks.length });
    void runPool(todo.map(([, run]) => run), 4, () => {
      done++;
      setPreload({ done, total: tasks.length });
    }, () => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);

  const loading =
    history.some((q) => q.isFetching) ||
    scans.some((q, i) => q.isFetching || (!!picks[i] && q.isPlaceholderData)) ||
    aemet.some((q, i) => q.isFetching || (wantAemet[i] && (at === null || !!aemetFrames[i]) && q.isPlaceholderData)) ||
    frames.isFetching;
  const counts = {
    opera: layers.filter((l) => l.source === "opera").length,
    aemet: layers.filter((l) => l.source === "aemet").length,
  };
  const stationHistories = new Map(radars.map((s, i) => [s.id, history[i]?.data]));
  return { layers, stationHistories, loading, counts, preload, accessError: wantOpera && operaStates.includes("error") };
}
