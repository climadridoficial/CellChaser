import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { RadarStation } from "@/lib/ord";
import type { RenderedScan } from "@/lib/odim";
import type { AemetObs } from "@/lib/aemet";
import type { AemetMapImage, Corners } from "@/lib/aemet-overlay";
import { useAemetMapOverlay } from "@/hooks/use-aemet-map-overlay";
import { useLightningOverlay } from "@/hooks/use-lightning-overlay";
import type { CompositeLayer } from "@/hooks/use-radar-composite";
import type { CompositeMode } from "@/lib/composite";
import { useStormTracks } from "@/hooks/use-storm-tracks";
import StormTracks from "./StormTracks";
import { legendStops, productInfo } from "@/lib/radar-products";
import { colorToValue, samplePixel } from "@/lib/inspector";
import { LIGHTNING_AGES, lightningAge, quadFraction } from "@/lib/lightning-inspector";
import { LIGHTNING_SIZE } from "@/lib/aemet-lightning";
import { cornersFromBounds } from "@/lib/aemet-overlay";

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
  onAemetBounds: (corners: Corners) => void;
  composite: CompositeLayer[];
  showStorms: boolean;
  stormStations: RadarStation[];
  at: number | null;
  compositeMode: CompositeMode;
  /** AEMET lightning-strike map (transparent PNG data URL) or null when off. */
  lightning: AemetMapImage | null;
  onLightningBounds: (corners: Corners) => void;
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
  composite,
  showStorms,
  stormStations,
  at,
  compositeMode,
  lightning,
  onLightningBounds,
}: Props) {
  const { t } = useI18n();
  const compositeRef = useRef<Map<string, L.ImageOverlay>>(new Map());
  const wantedRef = useRef<Set<string>>(new Set());
  const aemetRef = useRef<L.LayerGroup | null>(null);
  const aemetHandler = useRef(onSelectAemet);
  aemetHandler.current = onSelectAemet;
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const storms = useStormTracks(showStorms && !aemetImage?.editing, selectedId, stormStations, at, compositeMode);
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
    baseRef.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
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
  useLightningOverlay(mapRef, lightning, onLightningBounds);

  // Spain radar composite: one image per radar. A replaced image stays until
  // its successor has finished loading, so time steps never flash empty.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = compositeRef.current;
    const wanted = new Set(composite.map((l) => l.key));
    const incoming = new Set(composite.filter((l) => !current.has(l.key)).map((l) => l.radarId));
    const radarOf = (key: string) => (current.get(key) as (L.ImageOverlay & { radarId?: string }) | undefined)?.radarId;
    for (const key of [...current.keys()]) {
      if (!wanted.has(key) && !incoming.has(radarOf(key) ?? "")) {
        current.get(key)?.remove();
        current.delete(key);
      }
    }
    for (const layer of composite) {
      if (current.has(layer.key)) continue;
      const overlay = L.imageOverlay(layer.image, layer.bounds, {
        opacity: layer.source === "aemet" ? 0.85 : 1,
        zIndex: 350,
        className: "radar-overlay",
        interactive: false,
      }) as L.ImageOverlay & { radarId?: string };
      overlay.radarId = layer.radarId;
      const retireOld = () => {
        for (const [key, o] of [...current]) {
          if (key !== layer.key && (o as typeof overlay).radarId === layer.radarId && !wantedRef.current.has(key)) {
            o.remove();
            current.delete(key);
          }
        }
      };
      overlay.once("load", retireOld);
      overlay.once("error", retireOld);
      overlay.addTo(map);
      current.set(layer.key, overlay);
    }
    wantedRef.current = wanted;
  }, [composite]);

  useEffect(() => () => {
    compositeRef.current.forEach((o) => o.remove());
    compositeRef.current.clear();
  }, []);

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
    // An explicit renderer controls the pane; the circle's pane alone is ignored.
    const renderer = L.canvas({ padding: 0.3, pane: "markerPane" });
    for (const o of aemet) {
      const active = o.idema === aemetSelected;
      const dot = L.circleMarker([o.lat, o.lon], {
        renderer,
        radius: active ? 7 : 5,
        color: "#0b1020",
        weight: 1,
        fillColor: active ? "#ffffff" : "#ffb020",
        fillOpacity: 0.95,
        pane: "markerPane",
      });
      // Invisible wider ring makes each dot much easier to tap on touch screens.
      const hit = L.circleMarker([o.lat, o.lon], {
        renderer,
        radius: 14,
        stroke: false,
        fillColor: "#000000",
        fillOpacity: 0.001,
        pane: "markerPane",
      });
      const tip = `${o.name}${o.ta !== undefined ? ` · ${o.ta} °C` : ""}`;
      dot.bindTooltip(tip, { direction: "top" });
      hit.bindTooltip(tip, { direction: "top" });
      const pick = () => aemetHandler.current(o);
      dot.on("click", pick);
      hit.on("click", pick);
      dot.addTo(group);
      hit.addTo(group);
    }
    return () => {
      group.clearLayers();
      renderer.remove();
    };
  }, [aemet, aemetSelected]);

  // Decoded radar scan overlay: the old image stays until the new one has loaded.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const previous = overlayRef.current;
    overlayRef.current = null;
    if (!scan) {
      previous?.remove();
      return;
    }
    const overlay = L.imageOverlay(scan.dataUrl, scan.bounds, {
      opacity: 1,
      zIndex: 400,
      className: "radar-overlay",
      interactive: false,
    });
    const retire = () => previous?.remove();
    overlay.once("load", retire);
    overlay.once("error", retire);
    overlay.addTo(map);
    overlayRef.current = overlay;
  }, [scan]);

  // Fly to the selected station
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const station = stations.find((s) => s.id === selectedId);
    if (station) map.flyTo([station.lat, station.lon], Math.max(map.getZoom(), 7), { duration: 0.7 });
  }, [selectedId, stations]);

  // Base map: OpenStreetMap streets or Esri satellite imagery (keyless) with place labels.
  const [satellite, setSatellite] = useState(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !satellite) return;
    baseRef.current?.remove();
    const imagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Imagery &copy; Esri · radar: RainViewer / EUMETNET OPERA", maxZoom: 12, zIndex: 0,
    }).addTo(map);
    const labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 12, zIndex: 1 }).addTo(map);
    return () => {
      imagery.remove(); labels.remove();
      baseRef.current?.addTo(map);
    };
  }, [satellite]);

  // Range rings of the selected radar. AEMET publishes two OPERA scans per radar:
  // long range (250 km, DBZH/TH) and short-range Doppler (~150 km, DBZH/VRADH).
  useEffect(() => {
    const map = mapRef.current;
    const station = selectedId ? stations.find((s) => s.id === selectedId) : null;
    if (!map || !station) return;
    const rings = (station.id.startsWith("aemet-") ? [240] : [250, 150]).map((km) =>
      L.circle([station.lat, station.lon], {
        radius: km * 1000, color: "#94a3b8", weight: 1.5, dashArray: km === 150 ? "2 6" : "8 6", fill: false, interactive: false,
      }).addTo(map),
    );
    return () => rings.forEach((r) => r.remove());
  }, [selectedId, stations]);


  // User location: "on" (dot), "heading" (dot + direction cone), "off"
  const [locMode, setLocMode] = useState<"on" | "heading" | "off">("on");
  const [legendHidden, setLegendHidden] = useState(false);
  useEffect(() => { if (!showStorms) setLegendHidden(false); }, [showStorms]);
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

  // Crosshair inspector + vertical colour key
  const [inspectOn, setInspectOn] = useState(false);
  const [keyOn, setKeyOn] = useState(true);
  const [readout, setReadout] = useState<string | null>(null);
  const [lightningReadout, setLightningReadout] = useState<string | null>(null);
  const info = scan ? scan.info : productInfo("DBZH");
  const showKey = keyOn && (!!scan || composite.length > 0);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !inspectOn) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const center = map.getCenter();
      const z = map.getZoom();
      const p = map.project(center, z);
      const overlays: L.ImageOverlay[] = [];
      if (overlayRef.current) overlays.push(overlayRef.current);
      else overlays.push(...[...compositeRef.current.values()].reverse());
      let result: string | null = null;
      let covered = false;
      for (const o of overlays) {
        const b = o.getBounds();
        if (!b.contains(center)) continue;
        const img = o.getElement() as HTMLImageElement | undefined;
        if (!img) continue;
        const nw = map.project(b.getNorthWest(), z);
        const se = map.project(b.getSouthEast(), z);
        const px = samplePixel(img, (p.x - nw.x) / (se.x - nw.x), (p.y - nw.y) / (se.y - nw.y));
        if (!px) continue;
        covered = true;
        if (px[3] < 30) continue;
        const v = colorToValue(info, px[0], px[1], px[2]);
        if (v === null) continue;
        result = `${info.key} ${v.toFixed(info.scale === "reflectivity" ? 0 : 1)} ${info.unit}`;
        break;
      }
      setReadout(result ?? (covered ? t("inspectNoEcho") : t("inspectNoData")));
      let age: string | null = null;
      if (lightning && !lightning.editing) {
        const img = map.getContainer().querySelector<HTMLImageElement>('img.lightning-overlay');
        const corners = (lightning.corners ?? cornersFromBounds(lightning.bounds)).map(c => { const px = map.latLngToLayerPoint(c); return [px.x, px.y] as [number, number]; });
        const target = map.latLngToLayerPoint(center);
        const fraction = quadFraction([target.x, target.y], corners, LIGHTNING_SIZE.w, LIGHTNING_SIZE.h);
        if (img && fraction) {
          // Small source-pixel tolerance for AEMET's tiny cross markers.
          for (let radius = 0; radius <= 2 && !age; radius++) {
            for (let y = -radius; y <= radius && !age; y++) for (let x = -radius; x <= radius && !age; x++) {
              const pixel = samplePixel(img, fraction[0] + x / LIGHTNING_SIZE.w, fraction[1] + y / LIGHTNING_SIZE.h);
              if (pixel) age = lightningAge(pixel);
            }
          }
        }
      }
      setLightningReadout(age ? t("inspectLightningAge", { h: age }) : t("inspectNoLightning"));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(read); };
    schedule();
    map.on("move", schedule);
    const id = window.setInterval(schedule, 1000);
    return () => {
      map.off("move", schedule);
      window.clearInterval(id);
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectOn, scan, composite, info.key, lightning, t]);

  const label =
    locMode === "on" ? t("locationOn") : locMode === "heading" ? t("locationHeading") : t("locationOff");

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <StormTracks map={mapRef.current} tracks={storms.tracks} />
      {showStorms && !legendHidden && <div className="storm-legend" role="status">
        <button type="button" className="storm-legend-close" aria-label={t("close")} title={t("close")} onClick={() => setLegendHidden(true)}>×</button>
        <div className="font-medium">{t("stormForecast")}</div>
        <div className="storm-legend-scale">
          <span><i className="storm-light" />{t("stormLight")} &lt;40</span>
          <span><i className="storm-strong" />{t("stormStrong")} 40–49</span>
          <span><i className="storm-veryStrong" />{t("stormVeryStrong")} 50–59</span>
          <span><i className="storm-extreme" />{t("stormExtreme")} ≥60 dBZ</span>
        </div>
        <p>{storms.loading ? t("updating") : !storms.supported ? t("stormUnsupported") : storms.incomplete ? t("stormPartial") : !storms.tracks.length ? t("stormNone") : !storms.tracks.some(s => s.forecast) ? t("stormWaiting") : `${storms.tracks.length} · ${t("stormTracks")}`}</p>
        <p className="text-muted-foreground">{t("stormDisclaimer")}</p>
      </div>}
      {showKey && (
        <div className="color-key" aria-label={info.label}>
          <div className="color-key-unit">{info.unit || info.key}</div>
          {[...legendStops(info)].reverse().map((s) => (
            <div key={s.value} className="color-key-row"><i style={{ background: s.css }} />{s.value}</div>
          ))}
          {lightning && <div className="lightning-key" aria-label={t("lightningAgeKey")}>
            <div className="color-key-unit">{t("lightningShort")}</div>
            {LIGHTNING_AGES.map(age => <div key={age.hours} className="color-key-row"><i className={`lightning-age-${age.token}`} />{age.hours} h</div>)}
          </div>}
        </div>
      )}
      {keyOn && lightning && !showKey && <div className="color-key" aria-label={t("lightningAgeKey")}><div className="color-key-unit">{t("lightningShort")}</div>{LIGHTNING_AGES.map(age => <div key={age.hours} className="color-key-row"><i className={`lightning-age-${age.token}`} />{age.hours} h</div>)}</div>}
      {inspectOn && (
        <>
          <div className="inspector-cross" aria-hidden="true" />
          <div className="inspector-readout" role="status"><div>{readout ?? "…"}</div>{lightning && <div className="text-xs text-muted-foreground">{lightningReadout ?? "…"}</div>}</div>
        </>
      )}
      <button type="button" onClick={() => setInspectOn((v) => !v)} aria-pressed={inspectOn} aria-label={t("inspector")} title={t("inspector")} className={`map-tool-btn inspector-btn${inspectOn ? " map-tool-on" : ""}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /></svg>
      </button>
      <button type="button" onClick={() => setSatellite((v) => !v)} aria-pressed={satellite} aria-label={t("satellite")} title={t("satellite")} className={`map-tool-btn sat-btn${satellite ? " map-tool-on" : ""}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>
      </button>
      <button type="button" onClick={() => setKeyOn((v) => !v)} aria-pressed={keyOn} aria-label={t("colorKey")} title={t("colorKey")} className={`map-tool-btn key-btn${keyOn ? " map-tool-on" : ""}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="3" width="8" height="18" rx="1" /><path d="M8 9h8M8 15h8" /></svg>
      </button>
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
