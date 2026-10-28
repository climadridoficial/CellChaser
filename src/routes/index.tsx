import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useCallback, useMemo, useState } from "react";
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
import { RadarSession } from "@/components/RadarSession";
import type { AemetMapImage, RadarBounds } from "@/lib/aemet-overlay";
import MapLoadBoundary from "@/components/MapLoadBoundary";
import { useRadarComposite } from "@/hooks/use-radar-composite";

const RadarMap = lazy(() => import("@/components/RadarMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RadarES — European weather radar, layer by layer" },
      {
        name: "description",
        content:
          "RadarES combines RainViewer tiles, a self-hosted LibreWXR instance and raw EUMETNET OPERA station scans (DBZH, TH, VRADH) on one interactive map.",
      },
      { property: "og:title", content: "RadarES — European weather radar, layer by layer" },
      {
        property: "og:description",
        content:
          "Toggle RainViewer, LibreWXR and raw OPERA radar station data, then click any station to inspect its products, tilts and scan times.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <RadarSession><Home /></RadarSession>,
});

function Home() {
  const { settings, update, loaded } = useSettings();
  const [tileSource, setTileSource] = useState<TileSource>("rainviewer");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStations, setShowStations] = useState(true);
  const [selected, setSelected] = useState<RadarStation | null>(null);
  const [scan, setScan] = useState<RenderedScan | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAemet, setShowAemet] = useState(false);
  const [aemetSel, setAemetSel] = useState<AemetObs | null>(null);
  const [alignmentTarget, setAlignmentTarget] = useState<AlignmentTarget | null>(null);
  const [aemetImage, setAemetImage] = useState<AemetMapImage | null>(null);
  const handleAemetImage = useCallback((value: AemetMapImage | null) => setAemetImage(value), []);
  const handleAemetBounds = useCallback((bounds: RadarBounds) => setAemetImage(current => current ? { ...current, bounds } : current), []);
  const closeAlignment = useCallback(() => { setAlignmentTarget(null); setAemetImage(null); }, []);

  const rainviewer = useQuery({
    queryKey: ["radar-index", tileSource, settings.librewxrUrl],
    enabled: tileSource !== "none",
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const base =
        tileSource === "librewxr"
          ? settings.librewxrUrl.trim().replace(/\/+$/, "")
          : "https://api.rainviewer.com";
      if (!base) return null;
      const res = await fetch(`${base}/public/weather-maps.json`);
      if (!res.ok) throw new Error("Radar tile index unavailable");
      const data = (await res.json()) as { radar?: { past?: { path: string; time: number }[] } };
      const past = data.radar?.past ?? [];
      return past[past.length - 1]?.path ?? null;
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
      ? (aemet.error as Error).message
      : aemet.data
        ? `${aemet.data.length} stations · updates hourly`
        : showAemet
          ? "Loading…"
          : "Live temp, wind, rain, pressure";

  const visibleStations = useMemo(() => {
    const fixNames: Record<string, string> = { SanSebastian: "San Sebastián" };
    const opera: RadarStation[] = (stations.data ?? []).map((s) => ({ ...s, name: fixNames[s.name] ?? s.name }));
    const all = stations.data ? [...opera, ...aemetOnlyStations(opera)] : [];
    if (settings.country === "all") return all;
    const code = settings.country.replace(/^0+/, "");
    return all.filter((s) => s.country.replace(/^0+/, "") === code);
  }, [stations.data, settings.country]);

  // Spanish radars for the composite, independent of the station country filter.
  const spainRadars = useMemo(() => {
    const opera = (stations.data ?? []).filter((s) => s.country.replace(/^0+/, "") === "724");
    return stations.data ? [...opera, ...aemetOnlyStations(opera)] : [];
  }, [stations.data]);
  const composite = useRadarComposite(settings.composite, spainRadars, settings.meteogateKey);
  const compositeOn = settings.composite !== "off";
  const compositeNote = !compositeOn
    ? "Apagado"
    : composite.loading && composite.layers.length === 0
      ? "Cargando radares…"
      : `${composite.counts.opera} OPERA · ${composite.counts.aemet} AEMET${composite.loading ? " · actualizando…" : ""}`;

  const tileUrl = compositeOn ? null : tileTemplate(settings, rainviewer.data ?? null, tileSource);

  const handleScan = useCallback((next: RenderedScan | null) => setScan(next), []);
  const closePanel = useCallback(() => {
    setSelected(null);
    setScan(null);
  }, []);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      <h1 className="sr-only">RadarES — European weather radar layers</h1>

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
              composite={scan || aemetImage ? [] : composite.layers}
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
          Radar<span className="text-primary">ES</span>
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
        />
      </div>

      {(stations.isLoading || stations.isError) && (
        <div className="statusbar">
          {stations.isError
            ? (stations.error as Error).message
            : "Loading European radar stations…"}
        </div>
      )}

      {selected && (
        <StationPanel
          station={selected}
          apiKey={settings.meteogateKey}
          onClose={closePanel}
          onScan={handleScan}
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
        />
      )}
    </main>
  );
}
