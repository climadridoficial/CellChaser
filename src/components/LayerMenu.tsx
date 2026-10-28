import { useEffect, useRef } from "react";
import type { TileSource } from "@/lib/settings";
import { COMPOSITE_MODES, type CompositeMode } from "@/lib/composite";

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

  const activeLabel =
    props.composite !== "off"
      ? (COMPOSITE_MODES.find((m) => m.id === props.composite)?.label ?? "Compuesto")
      : (SOURCES.find((s) => s.id === source)?.label ?? "Layers");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className={open ? "chip chip-active" : "chip"}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Layers · {activeLabel}
        <span className="ml-1.5 text-[0.6rem]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-[1200] max-h-[calc(100vh-6rem)] w-[17rem] overflow-y-auto rounded-xl border border-border bg-card/95 p-3 shadow-[0_24px_60px_-20px_oklch(0_0_0/0.75)] backdrop-blur-xl"
        >
          <h3 className="section-title">Compuesto radares España</h3>
          <p className="hint mt-1">{props.compositeNote}</p>
          <div className="mt-2 space-y-1">
            {COMPOSITE_MODES.map((m) => (
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

          <h3 className="section-title mt-4">Tile layer</h3>
          {props.composite !== "off" && (
            <p className="hint mt-1">Oculta mientras el compuesto está activo.</p>
          )}
          <div className="mt-2 space-y-1">
            {SOURCES.map((s) => (
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

          <h3 className="section-title mt-4">Overlays</h3>
          <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 hover:bg-secondary/70">
            <span>
              <span className="block text-xs font-medium text-foreground">OPERA raw stations</span>
              <span className="hint block">{props.stationCount} stations · click to inspect</span>
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
              <span className="block text-xs font-medium text-foreground">AEMET weather stations</span>
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
            Settings
          </button>
        </div>
      )}
    </div>
  );
}
