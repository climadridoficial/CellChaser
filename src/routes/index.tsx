import { IBERIA } from "@/lib/ord";
import { LanguageProvider, useI18n } from "@/lib/i18n";
import LanguageMenu from "@/components/LanguageMenu";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
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
import { RadarSession, useRadarSession } from "@/components/RadarSession";
import { boundsOfCorners, validCorners, type AemetMapImage, type Corners } from "@/lib/aemet-overlay";
import MapLoadBoundary from "@/components/MapLoadBoundary";
import { useRadarComposite } from "@/hooks/use-radar-composite";
import TimeSlider from "@/components/TimeSlider";
import { pickFrame } from "@/lib/timeline";
import { NO_PRELOAD, sumProgress, type PreloadProgress } from "@/lib/preload";
import { LIGHTNING_ALIGNMENT_ENABLED, LIGHTNING_CORNERS, loadLightningImages } from "@/lib/aemet-lightning";
import { supabase } from "@/integrations/supabase/client";
import { OPERA_POLL_OPTIONS } from "@/lib/opera-refresh";
import { loadFailureState } from "@/lib/load-status";

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
  component: () => <LanguageProvider><RadarSession><IntroOverlay /><Home /></RadarSession></LanguageProvider>,
});

function Home() {
  const { t } = useI18n();
  const { userId } = useRadarSession();
  const { settings, update, loaded } = useSettings();
  const [tileSource, setTileSource] = useState<TileSource>("rainviewer");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStations, setShowStations] = useState(true);
  const [selected, setSelected] = useState<RadarStation | null>(null);
  const [scan, setScan] = useState<RenderedScan | null>(null);
  const [stationBackup, setStationBackup] = useState<{ id: string; enabled: boolean } | null>(null);
  const handleBackupChange = useCallback((id: string, enabled: boolean) => setStationBackup({ id, enabled }), []);
  const [backupImage, setBackupImage] = useState<AemetMapImage | null>(null);
  const handleBackupImage = useCallback((image: AemetMapImage | null) => setBackupImage(image), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAemet, setShowAemet] = useState(false);
  const [aemetSel, setAemetSel] = useState<AemetObs | null>(null);
  const [alignmentTarget, setAlignmentTarget] = useState<AlignmentTarget | null>(null);
  const [aemetImage, setAemetImage] = useState<AemetMapImage | null>(null);
  const handleAemetImage = useCallback((value: AemetMapImage | null) => setAemetImage(value), []);
  const handleAemetBounds = useCallback((corners: Corners) => setAemetImage(current => current ? { ...current, corners, bounds: boundsOfCorners(corners) } : current), []);
  const [at, setAt] = useState<number | null>(null);
  const [showStorms, setShowStorms] = useState(false);
  const [showLightning, setShowLightning] = useState(false);
  const [alignLightning, setAlignLightning] = useState(false);
  const [lightningEdit, setLightningEdit] = useState<AemetMapImage | null>(null);
  const [lightningCorners, setLightningCorners] = useState<Corners>(LIGHTNING_CORNERS);
  const handleLightningImage = useCallback((value: AemetMapImage | null) => {
    setLightningEdit(value);
    if (value?.corners && !value.editing) setLightningCorners(value.corners);
  }, []);
  const handleLightningBounds = useCallback((corners: Corners) => setLightningEdit(current => current ? { ...current, corners, bounds: boundsOfCorners(corners) } : current), []);
  useEffect(() => {
    let live = true;
    setLightningCorners(LIGHTNING_CORNERS);
    if (userId) supabase.from('radar_alignments').select('corners').eq('user_id', userId).eq('radar_code', 'lightning').maybeSingle().then(({ data }) => {
      if (live && validCorners(data?.corners)) setLightningCorners(data.corners);
    });
    return () => { live = false; };
  }, [userId]);
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
    ...OPERA_POLL_OPTIONS,
    queryFn: () => fetchStations(settings.meteogateKey || undefined),
  });

  const aemet = useQuery({
    queryKey: ["aemet-obs", settings.aemetKey],
    enabled: showAemet && loaded,
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
    queryFn: () => fetchAemetStations(settings.aemetKey.trim() || undefined),
  });
  const lightning = useQuery({
    queryKey: ["aemet-lightning"],
    enabled: showLightning,
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
    queryFn: loadLightningImages,
  });
  const lightningOverlay = useMemo<AemetMapImage | null>(() => {
    if (!showLightning) return null;
    if (LIGHTNING_ALIGNMENT_ENABLED && alignLightning && lightningEdit) return lightningEdit;
    if (!lightning.data) return null;
    return { code: 'lightning', image: lightning.data.echoes, corners: lightningCorners, bounds: boundsOfCorners(lightningCorners), editing: false, opacity: 0.85 };
  }, [showLightning, alignLightning, lightningEdit, lightning.data, lightningCorners]);

  const aemetNote = aemet.isError
      ? t("weatherUpdateFailed")
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
      : composite.accessError ? `${composite.counts.opera} OPERA · ${composite.counts.aemet} AEMET · ${t(loadFailureState(true, composite.layers.length) === "partial" ? "radarPartial" : "operaFailed")}`
      : `${composite.counts.opera} OPERA · ${composite.counts.aemet} AEMET${composite.loading ? ` · ${t("updating")}` : ""}`;

  // With a radar open, only that radar is shown: other radars are hidden, and its
  // own composite image is kept only until the station view has rendered.
  const mapComposite = useMemo(() => {
    if (!selected) return composite.layers;
    if (scan || aemetImage || backupImage) return [];
    return composite.layers.filter((l) => l.radarId === selected.id);
  }, [scan, aemetImage, backupImage, selected, composite.layers]);

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
    setBackupImage(null);
  }, []);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
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
                setBackupImage(null);
                setSelected(st);
              }}
              scan={scan}
              aemetImage={aemetImage ?? (selected ? backupImage : null)}
              onAemetBounds={handleAemetBounds}
              composite={mapComposite}
              showStorms={showStorms}
              stormStations={spainRadars}
              at={at}
              compositeMode={settings.composite}
              lightning={lightningOverlay}
              lightningPeriod={lightning.data?.period ?? null}
              onLightningBounds={handleLightningBounds}
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

      <div className="toolbar">
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
          showLightning={showLightning}
          onShowLightningChange={setShowLightning}
          onAlignLightning={() => { closeAlignment(); closePanel(); setAemetSel(null); setLightningEdit(null); setShowLightning(true); setAlignLightning(true); }}
        />
        <LanguageMenu />
      </div>

      {(stations.isLoading || (stations.isError && composite.layers.length === 0)) && (
        <div className="statusbar">
          {stations.isError
            ? t("catalogueFailed")
            : t("loadStations")}
        </div>
      )}

      {selected && (
        <StationPanel
          key={selected.id}
          station={selected}
          sharedScan={composite.layers.find(l => l.radarId === selected.id)?.scan ?? null}
          sharedCandidate={composite.layers.find(l => l.radarId === selected.id)?.candidate ?? null}
          sharedHistory={composite.stationHistories.get(selected.id) ?? null}
          apiKey={settings.meteogateKey}
          onClose={closePanel}
          onScan={handleScan}
          onBackupChange={handleBackupChange}
          onBackupImage={handleBackupImage}
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

      {!alignmentTarget && !alignLightning && (
        <TimeSlider
          at={at}
          onChange={setAt}
          loading={composite.loading || rainviewer.isFetching}
          preload={sumProgress(compositeOn ? composite.preload : NO_PRELOAD, selected ? stationPreload : NO_PRELOAD)}
          note={sliderNote}
        />
      )}

      {aemetSel && !selected && <AemetPanel obs={aemetSel} onClose={() => setAemetSel(null)} />}

      {alignmentTarget && <AemetAlignment key={alignmentTarget.code} target={alignmentTarget} value={aemetImage} onChange={handleAemetImage} onClose={closeAlignment} />}
      {LIGHTNING_ALIGNMENT_ENABLED && alignLightning && <AemetAlignment target={{ code: 'lightning', name: t('lightning'), lat: 40, lon: -3 }} value={lightningEdit} onChange={handleLightningImage} onClose={() => { setAlignLightning(false); setLightningEdit(null); }} loadImages={loadLightningImages} defaultCorners={lightningCorners} />}

      {settingsOpen && (
        <SettingsSheet
          settings={settings}
          onChange={update}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}
