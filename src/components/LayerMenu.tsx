import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import type { TileSource } from "@/lib/settings";
import { COMPOSITE_MODES, type CompositeMode } from "@/lib/composite";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: TileSource;
  onSourceChange: (source: TileSource) => void;
  showStations: boolean;
  onShowStationsChange: (show: boolean) => void;
  stationCount: number;
  onOpenSettings: () => void;
  showAemet: boolean;
  onShowAemetChange: (show: boolean) => void;
  aemetNote: string;
  composite: CompositeMode;
  onCompositeChange: (mode: CompositeMode) => void;
  compositeNote: string;
  showStorms: boolean;
  onShowStormsChange: (show: boolean) => void;
  showLightning: boolean;
  onShowLightningChange: (show: boolean) => void;
  onAlignLightning: () => void;
}

const SOURCES: { id: TileSource; label: string; note: string }[] = [
  {
    id: "rainviewer",
    label: "RainViewer tiles",
    note: "Fast fallback — reflectivity, blue only (free tier).",
  },
  {
    id: "librewxr",
    label: "LibreWXR tiles",
    note: "OPERA-fed, full colour schemes and zoom levels. No setup needed.",
  },
  { id: "none", label: "No tile layer", note: "Base map only." },
];

export default function LayerMenu(props: Props) {
  const { t } = useI18n();
  const { open, onOpenChange, source, onSourceChange } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onOpenChange]);

  const modes = COMPOSITE_MODES.map((m) => ({ ...m, label: t(m.id === "opendata" ? "modeOpendata" : m.id === "opera-fallback" ? "modeFallback" : m.id === "opera" ? "modeOpera" : "off"), note: t(m.id === "opendata" ? "noteOpendata" : m.id === "opera-fallback" ? "noteFallback" : m.id === "opera" ? "noteOpera" : "noteOff") }));
  const sources = SOURCES.map((s) => ({ ...s, label: t(s.id === "rainviewer" ? "rainviewer" : s.id === "librewxr" ? "librewxr" : "noTiles"), note: t(s.id === "rainviewer" ? "rainviewerNote" : s.id === "librewxr" ? "librewxrNote" : "baseOnly") }));
  const activeLabel =
    props.composite !== "off"
      ? (modes.find((m) => m.id === props.composite)?.label ?? "Compuesto")
      : (sources.find((s) => s.id === source)?.label ?? "Layers");

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        onClick={() => onOpenChange(!open)}
        className={`${open ? "chip chip-active" : "chip"} min-w-0 max-w-full`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="truncate">{t("layers")} · {activeLabel}</span>
        <span className="ml-1.5 text-[0.6rem]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-[1200] max-h-[calc(100vh-6rem)] w-[17rem] overflow-y-auto rounded-xl border border-border bg-card/95 p-3 shadow-[0_24px_60px_-20px_oklch(0_0_0/0.75)] backdrop-blur-xl"
        >
          <h3 className="section-title">{t("composite")}</h3>
          <p className="hint mt-1">{props.compositeNote}</p>
          <div className="mt-2 space-y-1">
            {modes.map((m) => (
              <button
                key={m.id}
                role="menuitemradio"
                aria-checked={props.composite === m.id}
                onClick={() => props.onCompositeChange(m.id)}
                className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  props.composite === m.id
                    ? "border-primary/60 bg-primary/15"
                    : "border-transparent hover:bg-secondary/70"
                }`}
              >
                <span className="block text-xs font-medium text-foreground">{m.label}</span>
                <span className="hint block">{m.note}</span>
              </button>
            ))}
          </div>

          <h3 className="section-title mt-4">{t("tileLayer")}</h3>
          {props.composite !== "off" && (
            <p className="hint mt-1">{t("tileHidden")}</p>
          )}
          <div className="mt-2 space-y-1">
            {sources.map((s) => (
              <button
                key={s.id}
                role="menuitemradio"
                aria-checked={source === s.id}
                onClick={() => onSourceChange(s.id)}
                className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  source === s.id
                    ? "border-primary/60 bg-primary/15"
                    : "border-transparent hover:bg-secondary/70"
                }`}
              >
                <span className="block text-xs font-medium text-foreground">{s.label}</span>
                <span className="hint block">{s.note}</span>
              </button>
            ))}
          </div>

          <h3 className="section-title mt-4">{t("overlays")}</h3>
          <label className="mt-2 flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-secondary/70">
            <span className="text-xs font-medium">{t("stormTracks")}</span>
            <input type="checkbox" checked={props.showStorms} onChange={e => props.onShowStormsChange(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          </label>
          <label className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-secondary/70">
            <span>
              <span className="block text-xs font-medium text-foreground">{t("lightning")}</span>
              <span className="hint block">{t("lightningNote")}</span>
            </span>
            <input type="checkbox" checked={props.showLightning} onChange={e => props.onShowLightningChange(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          </label>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { onOpenChange(false); props.onAlignLightning(); }}><Pencil />{t("alignLightning")}</Button>
          <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 hover:bg-secondary/70">
            <span>
              <span className="block text-xs font-medium text-foreground">{t("operaStations")}</span>
              <span className="hint block">{t("stationsInspect", { n: props.stationCount })}</span>
            </span>
            <input
              type="checkbox"
              checked={props.showStations}
              onChange={(e) => props.onShowStationsChange(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
          </label>

          <label className="mt-1 flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 hover:bg-secondary/70">
            <span>
              <span className="block text-xs font-medium text-foreground">{t("aemetStations")}</span>
              <span className="hint block">{props.aemetNote}</span>
            </span>
            <input
              type="checkbox"
              checked={props.showAemet}
              onChange={(e) => props.onShowAemetChange(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
          </label>

          <button
            onClick={() => {
              onOpenChange(false);
              props.onOpenSettings();
            }}
            className="chip mt-3 w-full justify-center"
          >
            {t("settings")}
          </button>
        </div>
      )}
    </div>
  );
}
