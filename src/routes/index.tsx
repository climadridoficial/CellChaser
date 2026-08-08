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
  component: Home,
});

function Home() {
  const { settings, update, loaded } = useSettings();
  const [showPrecip, setShowPrecip] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [selected, setSelected] = useState<RadarStation | null>(null);
  const [scan, setScan] = useState<RenderedScan | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const usingLibre = settings.librewxrUrl.trim().length > 0;

  const rainviewer = useQuery({
    queryKey: ["rainviewer-index"],
    enabled: !usingLibre,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      if (!res.ok) throw new Error("RainViewer index unavailable");
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

  const visibleStations = useMemo(() => {
    const all = stations.data ?? [];
    if (settings.country === "all") return all;
    const code = settings.country.replace(/^0+/, "");
    return all.filter((s) => s.country.replace(/^0+/, "") === code);
  }, [stations.data, settings.country]);

  const tileUrl = showPrecip ? tileTemplate(settings, rainviewer.data ?? null) : null;

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
          <Suspense fallback={<div className="h-full w-full bg-secondary" />}>
            <RadarMap
              tileUrl={tileUrl}
              showStations={showStations}
              stations={visibleStations}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              scan={scan}
            />
          </Suspense>
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
          librewxrConfigured={usingLibre}
          onOpenSettings={() => setSettingsOpen(true)}
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
        />
      )}

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
