import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { RadarStation } from "@/lib/ord";
import { fetchLatestScan } from "@/lib/ord";
import { decodeAndRender } from "@/lib/odim";
import { aemetCodeFor } from "@/lib/aemet-radars";
import { AEMET_REFRESH_MS, loadAemetImages, type RadarBounds } from "@/lib/aemet-overlay";
import { AEMET_CALIBRATION } from "@/lib/aemet-calibration";
import { compositeSource, OPERA_MAX_AGE_MS, type CompositeMode, type OperaState } from "@/lib/composite";

export interface CompositeLayer {
  key: string;
  /** RadarStation.id this image belongs to. */
  radarId: string;
  source: "opera" | "aemet";
  image: string;
  bounds: RadarBounds;
}

const REFRESH_MS = 10 * 60_000;
// Lighter than the station panel's full-detail render: 10 radars at once.
const COMPOSITE_SIZE = 1000;

/** Spanish radars (OPERA + AEMET-only) drawn together on the map. */
export function useRadarComposite(mode: CompositeMode, radars: RadarStation[], apiKey: string) {
  const opera = useQueries({
    queries: radars.map((s) => ({
      queryKey: ["composite-opera", s.id, apiKey],
      enabled: !s.offline && (mode === "opera" || mode === "opera-fallback"),
      staleTime: REFRESH_MS,
      refetchInterval: REFRESH_MS,
      retry: 1,
      queryFn: async () => {
        const latest = await fetchLatestScan(s.id, "DBZH", OPERA_MAX_AGE_MS, apiKey || undefined);
        if (!latest) return null;
        const scan = await decodeAndRender({
          href: latest.href,
          product: "DBZH",
          level: latest.level,
          time: latest.time,
          fallbackStation: { lat: s.lat, lon: s.lon },
          size: COMPOSITE_SIZE,
        });
        return { image: scan.dataUrl, bounds: scan.bounds as RadarBounds, time: latest.time };
      },
    })),
  });

  const operaStates: OperaState[] = radars.map((s, i) => {
    if (s.offline) return null;
    const q = opera[i];
    if (!q || q.isPending) return "loading";
    return q.data ? "ok" : "missing";
  });

  const aemetCodes = radars.map((s) => {
    const code = aemetCodeFor(s);
    return code && AEMET_CALIBRATION[code] ? code : null;
  });
  const wantAemet = radars.map((_, i) => compositeSource(mode, !!aemetCodes[i], operaStates[i]!) === "aemet");

  const aemet = useQueries({
    queries: radars.map((_, i) => ({
      queryKey: ["composite-aemet", aemetCodes[i]],
      enabled: wantAemet[i]!,
      staleTime: AEMET_REFRESH_MS,
      refetchInterval: AEMET_REFRESH_MS,
      retry: 2,
      queryFn: async () => {
        const images = await loadAemetImages(aemetCodes[i]!, Math.floor(Date.now() / AEMET_REFRESH_MS));
        return images.echoes;
      },
    })),
  });

  const layers = useMemo(() => {
    const out: CompositeLayer[] = [];
    radars.forEach((s, i) => {
      const source = compositeSource(mode, !!aemetCodes[i], operaStates[i]!);
      if (source === "opera") {
        const d = opera[i]?.data;
        if (d) out.push({ key: `opera-${s.id}-${d.time}`, radarId: s.id, source, image: d.image, bounds: d.bounds });
      } else if (source === "aemet") {
        const img = aemet[i]?.data;
        const code = aemetCodes[i]!;
        if (img) out.push({ key: `aemet-${code}-${img.length}-${aemet[i]!.dataUpdatedAt}`, radarId: s.id, source, image: img, bounds: AEMET_CALIBRATION[code]! });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, radars, opera.map((q) => q.dataUpdatedAt).join(), aemet.map((q) => q.dataUpdatedAt).join(), operaStates.join()]);

  const loading = opera.some((q) => q.isFetching) || aemet.some((q) => q.isFetching);
  const counts = {
    opera: layers.filter((l) => l.source === "opera").length,
    aemet: layers.filter((l) => l.source === "aemet").length,
  };
  return { layers, loading, counts };
}
