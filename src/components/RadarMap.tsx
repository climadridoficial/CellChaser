import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { RadarStation } from "@/lib/ord";
import type { RenderedScan } from "@/lib/odim";
import type { AemetObs } from "@/lib/aemet";
import type { AemetMapImage, RadarBounds } from "@/lib/aemet-overlay";
import { useAemetMapOverlay } from "@/hooks/use-aemet-map-overlay";

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
  aemetImage: AemetMapImage | null;
  onAemetBounds: (bounds: RadarBounds) => void;
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
  aemetImage,
  onAemetBounds,
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
    if (tileUrl && !scan && !aemetImage) {
      // RainViewer's free tiles stop at zoom 7 and return a "Zoom level not supported"
      // image beyond that; upscale zoom-7 tiles instead of requesting higher ones.
      const native = tileUrl.includes("rainviewer.com") ? 7 : 12;
      tileRef.current = L.tileLayer(tileUrl, { opacity: 0.75, maxZoom: 12, maxNativeZoom: native, zIndex: 300 }).addTo(map);
    }
  }, [tileUrl, scan, !!aemetImage]);

  useAemetMapOverlay(mapRef, aemetImage, onAemetBounds);

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

  // User location: "on" (dot), "heading" (dot + direction cone), "off"
  const [locMode, setLocMode] = useState<"on" | "heading" | "off">("on");
  const userRef = useRef<L.Marker | null>(null);
  const headingRef = useRef<number | null>(null);
  const centeredRef = useRef(false);

  const applyHeading = () => {
    const el = userRef.current?.getElement()?.querySelector<HTMLElement>(".user-cone");
    if (!el) return;
    const h = headingRef.current;
    el.style.display = locMode === "heading" && h !== null ? "block" : "none";
    if (h !== null) el.style.transform = `rotate(${h}deg)`;
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || locMode === "off" || !("geolocation" in navigator)) {
      userRef.current?.remove();
      userRef.current = null;
      centeredRef.current = false;
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const ll: L.LatLngExpression = [pos.coords.latitude, pos.coords.longitude];
        if (!userRef.current) {
          userRef.current = L.marker(ll, {
            icon: L.divIcon({
              className: "",
              html: `<div class="user-loc"><span class="user-cone"></span><span class="user-dot"></span></div>`,
              iconSize: [60, 60],
              iconAnchor: [30, 30],
            }),
            interactive: false,
            zIndexOffset: 1000,
          }).addTo(map);
        } else userRef.current.setLatLng(ll);
        if (!centeredRef.current) {
          centeredRef.current = true;
          map.setView(ll, Math.max(map.getZoom(), 8));
        }
        applyHeading();
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locMode]);

  useEffect(() => {
    applyHeading();
    if (locMode !== "heading") return;
    const onOrient = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      let h: number | null = null;
      if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;
      else if (e.alpha !== null) h = (360 - e.alpha) % 360;
      if (h === null) return;
      headingRef.current = h;
      applyHeading();
    };
    const evt = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(evt, onOrient as EventListener);
    return () => window.removeEventListener(evt, onOrient as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locMode]);

  const cycleLoc = async () => {
    const next = locMode === "on" ? "heading" : locMode === "heading" ? "off" : "on";
    if (next === "heading") {
      const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (DOE?.requestPermission) {
        try {
          await DOE.requestPermission();
        } catch {
          /* ignore */
        }
      }
    }
    if (next === "on" && userRef.current) mapRef.current?.panTo(userRef.current.getLatLng());
    setLocMode(next);
  };

  const label =
    locMode === "on" ? "Ubicación activada (pulsa para modo brújula)" : locMode === "heading" ? "Modo brújula (pulsa para desactivar)" : "Ubicación desactivada (pulsa para activar)";

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <button type="button" onClick={cycleLoc} aria-label={label} title={label} className={`loc-btn loc-btn-${locMode}`}>
        {locMode === "heading" ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2 19 21 12 17 5 21z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" fill={locMode === "on" ? "currentColor" : "none"} /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
        )}
      </button>
    </div>
  );
}
