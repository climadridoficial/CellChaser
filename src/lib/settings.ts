import { useCallback, useEffect, useState } from "react";

export interface RadarSettings {
  /** Base URL of a self-hosted LibreWXR instance (same tile scheme as RainViewer). */
  librewxrUrl: string;
  /** Optional Meteogate API key for heavier OPERA use. */
  meteogateKey: string;
  /** Free AEMET OpenData API key for live weather stations. */
  aemetKey: string;
  /** Radar station country filter (ISO numeric, from the WIGOS id). */
  country: string;
}

export const DEFAULT_SETTINGS: RadarSettings = {
  librewxrUrl: "",
  meteogateKey: "",
  aemetKey: "",
  country: "724",
};

const STORAGE_KEY = "radares.settings.v1";

export function useSettings() {
  const [settings, setSettings] = useState<RadarSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as RadarSettings) });
    } catch {
      /* ignore malformed storage */
    }
    setLoaded(true);
  }, []);

  const update = useCallback((patch: Partial<RadarSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return { settings, update, loaded };
}

export type TileSource = "rainviewer" | "librewxr" | "none";

/** Tile template for the precipitation layer for the chosen source. */
export function tileTemplate(
  settings: RadarSettings,
  timestampPath: string | null,
  source: TileSource = "rainviewer",
): string | null {
  if (source === "none") return null;
  const base = settings.librewxrUrl.trim().replace(/\/+$/, "");
  if (source === "librewxr") {
    if (!base) return null;
    return `${base}/v2/radar/latest/256/{z}/{x}/{y}/2/1_1.png`;
  }
  if (!timestampPath) return null;
  return `https://tilecache.rainviewer.com${timestampPath}/256/{z}/{x}/{y}/2/1_1.png`;
}
