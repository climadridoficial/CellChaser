import { useEffect, useRef } from "react";
import L from "leaflet";
import type { RadarStation } from "@/lib/ord";
import type { RenderedScan } from "@/lib/odim";
import type { AemetObs } from "@/lib/aemet";

interface Props {
  tileUrl: string | null;
  showStations: boolean;
  stations: RadarStation[];
  selectedId: string | null;
  onSelect: (station: RadarStation) => void;
  scan: RenderedScan | null;
  aemet: AemetObs[];
  aemetSelected: string | null;
  onSelectAemet: (o: AemetObs) => void;
}

export default function RadarMap({
  tileUrl,
  showStations,
  stations,
  selectedId,
  onSelect,
  scan,
  aemet,
  aemetSelected,
  onSelectAemet,
}: Props) {
  const aemetRef = useRef<L.LayerGroup | null>(null);
  const aemetHandler = useRef(onSelectAemet);
  aemetHandler.current = onSelectAemet;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const stationsRef = useRef<L.LayerGroup | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const selectHandler = useRef(onSelect);
  selectHandler.current = onSelect;

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [40.2, -3.6],
      zoom: 6,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · radar: RainViewer / EUMETNET OPERA',
      maxZoom: 12,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    stationsRef.current = L.layerGroup().addTo(map);
    aemetRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Precipitation tiles (RainViewer or LibreWXR) — hidden while a raw scan is shown
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) {
      tileRef.current.remove();
      tileRef.current = null;
    }
    if (tileUrl && !scan) {
      tileRef.current = L.tileLayer(tileUrl, { opacity: 0.75, maxZoom: 12, zIndex: 300 }).addTo(map);
    }
  }, [tileUrl, scan]);

  // Station markers
  useEffect(() => {
    const group = stationsRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showStations) return;
    for (const station of stations) {
      const active = station.id === selectedId;
      const marker = L.marker([station.lat, station.lon], {
        icon: L.divIcon({
          className: "",
          html: `<span class="station-pin${active ? " station-pin-active" : ""}"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        title: `${station.name} (${station.code})`,
      });
      marker.bindTooltip(`${station.name} · ${station.code}`, { direction: "top", offset: [0, -8] });
      marker.on("click", () => selectHandler.current(station));
      marker.addTo(group);
    }
  }, [stations, showStations, selectedId]);

  // AEMET weather station dots (canvas renderer: ~900 points)
  useEffect(() => {
    const group = aemetRef.current;
    if (!group) return;
    group.clearLayers();
    const renderer = L.canvas({ padding: 0.3 });
    for (const o of aemet) {
      const active = o.idema === aemetSelected;
      const dot = L.circleMarker([o.lat, o.lon], {
        renderer,
        radius: active ? 7 : 4.5,
        color: "#0b1020",
        weight: 1,
        fillColor: active ? "#ffffff" : "#ffb020",
        fillOpacity: 0.95,
        pane: "markerPane",
      });
      dot.bindTooltip(`${o.name}${o.ta !== undefined ? ` · ${o.ta} °C` : ""}`, { direction: "top" });
      dot.on("click", () => aemetHandler.current(o));
      dot.addTo(group);
    }
  }, [aemet, aemetSelected]);

  // Decoded radar scan overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (overlayRef.current) {
      overlayRef.current.remove();
      overlayRef.current = null;
    }
    if (scan) {
      overlayRef.current = L.imageOverlay(scan.dataUrl, scan.bounds, {
        opacity: 1,
        zIndex: 400,
        className: "radar-overlay",
        interactive: false,
      }).addTo(map);
    }
  }, [scan]);

  // Fly to the selected station
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const station = stations.find((s) => s.id === selectedId);
    if (station) map.flyTo([station.lat, station.lon], Math.max(map.getZoom(), 7), { duration: 0.7 });
  }, [selectedId, stations]);

  return <div ref={containerRef} className="h-full w-full" />;
}
