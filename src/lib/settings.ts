import { useCallback, useEffect, useState } from "react";
import type { CompositeMode } from "./composite";

export interface RadarSettings {
  /** Base URL of a self-hosted LibreWXR instance (same tile scheme as RainViewer). */
  librewxrUrl: string;
  /** Optional Meteogate API key for heavier OPERA use. */
  meteogateKey: string;
  /** Free AEMET OpenData API key for live weather stations. */
  aemetKey: string;
  /** Radar station country filter (ISO numeric, from the WIGOS id). */
  country: string;
  /** Spain radar composite source drawn on the map. */
  composite: CompositeMode;
}

export const DEFAULT_SETTINGS: RadarSettings = {
  // Public hosted LibreWXR instance — works out of the box, no key needed.
  librewxrUrl: "https://api.librewxr.net",
  meteogateKey: "",
  aemetKey: "",
  country: "iberia",
  composite: "opendata",
};

const STORAGE_KEY = "radares.settings.v1";

export function migrateCompositeDefault(mode: CompositeMode, migrated: boolean): CompositeMode {
  return !migrated && mode === "opera-fallback" ? "opendata" : mode;
}

export function useSettings() {
  const [settings, setSettings] = useState<RadarSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const migrated = !!window.localStorage.getItem("radares.compositeV3");
      if (raw) {
        const stored = JSON.parse(raw) as RadarSettings;
        // Older versions stored an empty LibreWXR URL; fall back to the public instance.
        if (!stored.librewxrUrl?.trim()) stored.librewxrUrl = DEFAULT_SETTINGS.librewxrUrl;
        // Spain-only was the old default; widen it to Spain + Portugal.
        if (stored.country === "724" && !window.localStorage.getItem("radares.iberia")) stored.country = "iberia";
        window.localStorage.setItem("radares.iberia", "1");
        // Move the previous default once; preserve subsequent manual choices.
        stored.composite = migrateCompositeDefault(stored.composite, migrated);
        const next = { ...DEFAULT_SETTINGS, ...stored };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSettings(next);
      }
      window.localStorage.setItem("radares.compositeV3", "1");
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
  if (!timestampPath) return null;
  const base = settings.librewxrUrl.trim().replace(/\/+$/, "");
  if (source === "librewxr") {
    if (!base) return null;
    return `${base}${timestampPath}/256/{z}/{x}/{y}/2/1_1.png`;
  }
  return `https://tilecache.rainviewer.com${timestampPath}/256/{z}/{x}/{y}/2/1_1.png`;
}
