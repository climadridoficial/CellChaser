import { useEffect } from "react";
import L from "leaflet";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { MIN_RADIUS_KM, cellIntensity, type StormTrack } from "@/lib/storm-tracking";

const LABELS: Record<StormTrack["intensity"], MessageKey> = { light: "stormLight", strong: "stormStrong", veryStrong: "stormVeryStrong", extreme: "stormExtreme" };
export default function StormTracks({ map, tracks }: { map: L.Map | null; tracks: StormTrack[] }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    if (!map) return;
    // Own pane above radar imagery so tracks are never hidden under the echoes.
    if (!map.getPane("stormPane")) { const pane = map.createPane("stormPane"); pane.style.zIndex = "640"; }
    const pane = "stormPane", renderer = L.svg({ pane });
    const group = L.layerGroup().addTo(map);
    const clock = (time: number) => new Date(time).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    for (const track of tracks) {
      const last = track.points.at(-1); if (!last || last.radiusKm < MIN_RADIUS_KM) continue;
      const className = `storm-${track.intensity}`;
      if (track.forecast) {
        // Preserve the four saved corners: Leaflet clipping can add vertices at map edges.
        L.polygon(track.forecast, { className: `storm-area ${className}`, weight: 2, fillOpacity: 0.1, noClip: true, smoothFactor: 0, pane, renderer }).bindTooltip(`${t("stormForecast")} · ${t(LABELS[track.intensity])} · ~${Math.round(last.dbz)} dBZ · ${track.speedKmh} km/h · ${clock(last.time)} → ${clock(last.time + 30 * 60_000)} UTC`).addTo(group);
      }
      L.polyline(track.points.map(p => [p.lat, p.lon] as [number, number]), { className: `storm-trace ${className}`, weight: 2, interactive: false, pane, renderer }).addTo(group);
      for (const point of track.points) {
        L.circleMarker([point.lat, point.lon], { radius: point === last ? 5 : 3, className: `storm-dot storm-${cellIntensity(point.dbz)}`, weight: 1, fillOpacity: 1, pane, renderer }).bindTooltip(`${clock(point.time)} UTC · ~${Math.round(point.dbz)} dBZ`).addTo(group);
      }
    }
    return () => { group.remove(); };
  }, [map, tracks, t, locale]);
  return null;
}