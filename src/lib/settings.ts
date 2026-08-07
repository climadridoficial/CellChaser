import { useCallback, useEffect, useState } from "react";

export interface RadarSettings {
  /** Base URL of a self-hosted LibreWXR instance (same tile scheme as RainViewer). */
  librewxrUrl: string;
  /** Optional Meteogate API key for heavier OPERA use. */
  meteogateKey: string;
  /** Radar station country filter (ISO numeric, from the WIGOS id). */
  country: string;
}

export const DEFAULT_SETTINGS: RadarSettings = {
  librewxrUrl: "",
  meteogateKey: "",
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

/** Tile template for the precipitation layer, respecting the LibreWXR override. */
export function tileTemplate(settings: RadarSettings, timestampPath: string | null): string | null {
  const base = settings.librewxrUrl.trim().replace(/\/+$/, "");
  if (base) {
    return `${base}/v2/radar/latest/256/{z}/{x}/{y}/2/1_1.png`;
  }
  if (!timestampPath) return null;
  return `https://tilecache.rainviewer.com${timestampPath}/256/{z}/{x}/{y}/2/1_1.png`;
}
