import { IBERIA } from "@/lib/ord";
import { LanguageProvider, useI18n } from "@/lib/i18n";
import LanguageMenu from "@/components/LanguageMenu";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useCallback, useMemo, useState, useEffect, useRef, type CSSProperties } from "react";
import { GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import ToolbarAdjustment from "@/components/ToolbarAdjustment";
import { TOOLBAR_POSITION_KEY, clampToolbarOffset, readToolbarPosition } from "@/lib/toolbar-position";
import { fetchStations } from "@/lib/ord";
import type { RadarStation } from "@/lib/ord";
import type { RenderedScan } from "@/lib/odim";
import { tileTemplate, useSettings, type TileSource } from "@/lib/settings";
import StationPanel from "@/components/StationPanel";
import SettingsSheet from "@/components/SettingsSheet";
import LayerMenu from "@/components/LayerMenu";
import AemetPanel from "@/components/AemetPanel";
import { aemetOnlyStations } from "@/lib/aemet-radars";
import { fetchAemetStations, type AemetObs } from "@/lib/aemet";
import AemetAlignment, { type AlignmentTarget } from "@/components/AemetAlignment";
import IntroOverlay from "@/components/IntroOverlay";
import { RadarSession } from "@/components/RadarSession";
import { boundsOfCorners, type AemetMapImage, type Corners } from "@/lib/aemet-overlay";
import MapLoadBoundary from "@/components/MapLoadBoundary";
import { useRadarComposite } from "@/hooks/use-radar-composite";
import TimeSlider from "@/components/TimeSlider";
import { pickFrame } from "@/lib/timeline";
import { NO_PRELOAD, sumProgress, type PreloadProgress } from "@/lib/preload";

const RadarMap = lazy(() => import("@/components/RadarMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CellChaser — European weather radar, layer by layer" },
      {
        name: "description",
        content:
          "CellChaser combines RainViewer tiles, a self-hosted LibreWXR instance and raw EUMETNET OPERA station scans (DBZH, TH, VRADH) on one interactive map.",
      },
      { property: "og:title", content: "CellChaser — European weather radar, layer by layer" },
      {
        property: "og:description",
        content:
          "Toggle RainViewer, LibreWXR and raw OPERA radar station data, then click any station to inspect its products, tilts and scan times.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LanguageProvider><RadarSession><Home /></RadarSession></LanguageProvider>,
});

function Home() {
  const { t } = useI18n();
  const { settings, update, loaded } = useSettings();
  const [tileSource, setTileSource] = useState<TileSource>("rainviewer");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStations, setShowStations] = useState(true);
  const [selected, setSelected] = useState<RadarStation | null>(null);
  const [scan, setScan] = useState<RenderedScan | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const [positionLoaded, setPositionLoaded] = useState(false);
  const [savedOffset, setSavedOffset] = useState<number | null>(null);
  const [toolbarOffset, setToolbarOffset] = useState(0);
  const [adjustingToolbar, setAdjustingToolbar] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number; offset: number } | null>(null);
  const constrainOffset = useCallback((value: number) => {
    const element = toolbarRef.current;
    if (!element) return value;
    const baseTop = parseFloat(getComputedStyle(element).top) || 0;
    return clampToolbarOffset(value, baseTop, element.offsetHeight, window.innerHeight);
  }, []);
  useEffect(() => {
    let value: number | null = null;
    try { value = readToolbarPosition(localStorage.getItem(TOOLBAR_POSITION_KEY)); } catch { /* Session-only adjustment. */ }
    setSavedOffset(value);
    setToolbarOffset(constrainOffset(value ?? 0));
    setPositionLoaded(true);
  }, [constrainOffset]);
  useEffect(() => {
    if (introDone && positionLoaded && savedOffset === null) setAdjustingToolbar(true);
  }, [introDone, positionLoaded, savedOffset]);
  useEffect(() => {
    const resize = () => setToolbarOffset(value => constrainOffset(value));
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    if (toolbarRef.current) observer.observe(toolbarRef.current);
    return () => { window.removeEventListener("resize", resize); observer.disconnect(); };
  }, [constrainOffset]);
  const saveToolbarPosition = () => {
    const value = constrainOffset(toolbarOffset);
    try { localStorage.setItem(TOOLBAR_POSITION_KEY, JSON.stringify(value)); } catch { /* Keep it for this visit. */ }
    setSavedOffset(value);
    setToolbarOffset(value);
    setAdjustingToolbar(false);
  };
  const [showAemet, setShowAemet] = useState(false);
  const [aemetSel, setAemetSel] = useState<AemetObs | null>(null);
  const [alignmentTarget, setAlignmentTarget] = useState<AlignmentTarget | null>(null);
  const [aemetImage, setAemetImage] = useState<AemetMapImage | null>(null);
  const handleAemetImage = useCallback((value: AemetMapImage | null) => setAemetImage(value), []);
  const handleAemetBounds = useCallback((corners: Corners) => setAemetImage(current => current ? { ...current, corners, bounds: boundsOfCorners(corners) } : current), []);
  const [at, setAt] = useState<number | null>(null);
  const [showStorms, setShowStorms] = useState(false);
  const closeAlignment = useCallback(() => { setAlignmentTarget(null); setAemetImage(null); }, []);

  const rainviewer = useQuery({
    queryKey: ["radar-index", tileSource, settings.librewxrUrl],
    enabled: tileSource !== "none",
    staleTime: 4 * 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const base =
        tileSource === "librewxr"
          ? settings.librewxrUrl.trim().replace(/\/+$/, "")
          : "https://api.rainviewer.com";
      if (!base) return null;
      const res = await fetch(`${base}/public/weather-maps.json`);
      if (!res.ok) throw new Error("Radar tile index unavailable");
      const data = (await res.json()) as { radar?: { past?: { path: string; time: number }[] } };
      return data.radar?.past ?? [];
    },
  });

  const stations = useQuery({
    queryKey: ["ord-stations", settings.meteogateKey],
    enabled: loaded,
    staleTime: 30 * 60_000,
    queryFn: () => fetchStations(settings.meteogateKey || undefined),
  });

  const aemet = useQuery({
    queryKey: ["aemet-obs", settings.aemetKey],
    enabled: showAemet && loaded,
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
    queryFn: () => fetchAemetStations(settings.aemetKey.trim() || undefined),
  });
  const aemetNote = aemet.isError
      ? t("loadFailed")
      : aemet.data
        ? t("aemetCount", { n: aemet.data.length })
        : showAemet
          ? t("loading")
          : t("aemetDefault");

  const visibleStations = useMemo(() => {
    const fixNames: Record<string, string> = { SanSebastian: "San Sebastián" };
    const opera: RadarStation[] = (stations.data ?? []).map((s) => ({ ...s, name: fixNames[s.name] ?? s.name }));
    // AEMET radars stay available even when OPERA can't be reached.
    const all = [...opera, ...aemetOnlyStations(opera)];
    if (settings.country === "all") return all;
    if (settings.country === "iberia") return all.filter((s) => IBERIA.includes(s.country.replace(/^0+/, "")));
    const code = settings.country.replace(/^0+/, "");
    return all.filter((s) => s.country.replace(/^0+/, "") === code);
  }, [stations.data, settings.country]);

  // Iberian radars (Spain + Portugal) for the composite, independent of the station country filter.
  const spainRadars = useMemo(() => {
    const opera = (stations.data ?? []).filter((s) => IBERIA.includes(s.country.replace(/^0+/, "")));
    return [...opera, ...aemetOnlyStations(opera)];
  }, [stations.data]);
  const [stationPreload, setStationPreload] = useState<PreloadProgress>(NO_PRELOAD);
  const composite = useRadarComposite(settings.composite, spainRadars, settings.meteogateKey, at);
  const compositeOn = settings.composite !== "off";
  const compositeNote = !compositeOn
    ? t("off")
    : composite.loading && composite.layers.length === 0
      ? t("loadingRadars")
      : `${composite.counts.opera} OPERA · ${composite.counts.aemet} AEMET${composite.loading ? ` · ${t("updating")}` : ""}`;

  // With a radar open, only that radar's composite image stays on the map.
  const mapComposite = useMemo(() => {
    if (scan || aemetImage) return [];
    if (!selected) return composite.layers;
    return composite.layers.filter((l) => l.radarId === selected.id);
  }, [scan, aemetImage, selected, composite.layers]);

  const frames = rainviewer.data ?? [];
  const tileFrame =
    at === null ? (frames[frames.length - 1] ?? null) : pickFrame(frames, (f) => f.time * 1000, at);
  const tileUrl = compositeOn ? null : tileTemplate(settings, tileFrame?.path ?? null, tileSource);
  const sliderNote =
    compositeOn && at !== null && !composite.loading && composite.layers.length === 0
      ? t("noSaved")
      : !compositeOn && tileSource !== "none" && at !== null && frames.length > 0 && !tileFrame && !scan
      ? t("tileHistory", { name: tileSource === "librewxr" ? "LibreWXR" : "RainViewer" })
      : null;

  const handleScan = useCallback((next: RenderedScan | null) => setScan(next), []);
  const closePanel = useCallback(() => {
    setSelected(null);
    setScan(null);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <IntroOverlay onComplete={finishIntro} />
      <h1 className="sr-only">CellChaser — European weather radar layers</h1>

      <div className="absolute inset-0">
        <ClientOnly fallback={<div className="h-full w-full bg-secondary" />}>
          <MapLoadBoundary>
          <Suspense fallback={<div className="h-full w-full bg-secondary" />}>
            <RadarMap
              tileUrl={tileUrl}
              showStations={showStations}
              stations={visibleStations}
              selectedId={selected?.id ?? null}
              onSelect={(st) => {
                closeAlignment();
                setAemetSel(null);
                setSelected(st);
              }}
              scan={scan}
              aemetImage={aemetImage}
              onAemetBounds={handleAemetBounds}
              composite={mapComposite}
              showStorms={showStorms}
              stormStations={spainRadars}
              at={at}
              compositeMode={settings.composite}
              aemet={showAemet ? (aemet.data ?? []) : []}
              aemetSelected={aemetSel?.idema ?? null}
              onSelectAemet={(o) => {
                closeAlignment();
                setSelected(null);
                setScan(null);
                setAemetSel(o);
              }}
            />
          </Suspense>
          </MapLoadBoundary>
        </ClientOnly>
      </div>

      <div ref={toolbarRef} className={adjustingToolbar ? "toolbar toolbar-adjusting" : "toolbar"} style={{ "--toolbar-offset": `${toolbarOffset}px` } as CSSProperties}>
        {adjustingToolbar && (
          <Button variant="ghost" className="toolbar-drag-handle" aria-label={t("dragToolbar")}
            onPointerDown={event => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { y: event.clientY, offset: toolbarOffset };
            }}
            onPointerMove={event => {
              const drag = dragRef.current;
              if (drag) setToolbarOffset(constrainOffset(drag.offset + event.clientY - drag.y));
            }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
            onKeyDown={event => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              setToolbarOffset(value => constrainOffset(value + (event.key === "ArrowDown" ? 4 : -4)));
            }}
          ><GripHorizontal /></Button>
        )}
        <span className="brand">
          Cell<span className="text-primary">Chaser</span>
        </span>
        <div className="h-5 w-px bg-border/80" aria-hidden />
        <LayerMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          source={tileSource}
          onSourceChange={setTileSource}
          showStations={showStations}
          onShowStationsChange={setShowStations}
          stationCount={visibleStations.length}
          onOpenSettings={() => setSettingsOpen(true)}
          showAemet={showAemet}
          onShowAemetChange={(v) => {
            setShowAemet(v);
            if (!v) setAemetSel(null);
          }}
          aemetNote={aemetNote}
          composite={settings.composite}
          onCompositeChange={(composite) => update({ composite })}
          compositeNote={compositeNote}
          showStorms={showStorms}
          onShowStormsChange={setShowStorms}
        />
        <LanguageMenu />
        {!alignmentTarget && (
          <TimeSlider
            at={at}
            onChange={setAt}
            loading={composite.loading || rainviewer.isFetching}
            preload={sumProgress(compositeOn ? composite.preload : NO_PRELOAD, selected ? stationPreload : NO_PRELOAD)}
            note={sliderNote}
          />
        )}
      </div>

      {adjustingToolbar && <ToolbarAdjustment onSave={saveToolbarPosition} onCancel={savedOffset === null ? undefined : () => {
        setToolbarOffset(constrainOffset(savedOffset));
        setAdjustingToolbar(false);
      }} />}

      {(stations.isLoading || stations.isError) && (
        <div className="statusbar">
          {stations.isError
            ? t("loadFailed")
            : t("loadStations")}
        </div>
      )}

      {selected && (
        <StationPanel
          station={selected}
          apiKey={settings.meteogateKey}
          onClose={closePanel}
          onScan={handleScan}
          at={at}
          onPreload={setStationPreload}
          onAlignAemet={(code) => {
            setAlignmentTarget({ code, name: selected.name, lat: selected.lat, lon: selected.lon });
            setSelected(null);
            setScan(null);
            setAemetSel(null);
          }}
        />
      )}

      {aemetSel && !selected && <AemetPanel obs={aemetSel} onClose={() => setAemetSel(null)} />}

      {alignmentTarget && <AemetAlignment key={alignmentTarget.code} target={alignmentTarget} value={aemetImage} onChange={handleAemetImage} onClose={closeAlignment} />}

      {settingsOpen && (
        <SettingsSheet
          settings={settings}
          onChange={update}
          onClose={() => setSettingsOpen(false)}
          onAdjustToolbar={() => { setSettingsOpen(false); setMenuOpen(false); setAdjustingToolbar(true); }}
        />
      )}
    </main>
  );
}
