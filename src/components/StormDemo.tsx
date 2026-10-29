import { useEffect, useState } from "react";
import L from "leaflet";
import { Pause, Play, RotateCcw, X, FlaskConical } from "lucide-react";
import { Button } from "./ui/button";
import StormTracks from "./StormTracks";
import { DEMO_DBZ, demoTracks } from "@/lib/storm-demo";
import { useI18n, type MessageKey } from "@/lib/i18n";

const LABELS: Record<string, MessageKey> = { light: "stormLight", strong: "stormStrong", veryStrong: "stormVeryStrong", extreme: "stormExtreme" };
export default function StormDemo({ map, onActiveChange }: { map: L.Map | null; onActiveChange: (active: boolean) => void }) {
  const { t } = useI18n();
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(0);
  const tracks = demoTracks(step);
  const track = tracks[0];
  const point = track?.points.at(-1);
  useEffect(() => {
    onActiveChange(active);
    return () => onActiveChange(false);
  }, [active, onActiveChange]);
  useEffect(() => {
    if (!active || !map) return;
    const center = map.getCenter(), zoom = map.getZoom();
    map.fitBounds([[39.25, -4.85], [40.65, -2.75]], { padding: [45, 45], animate: false });
    return () => { map.setView(center, zoom, { animate: false }); };
  }, [active, map]);
  useEffect(() => {
    if (!active || !playing) return;
    const id = window.setInterval(() => setStep(current => (current + 1) % DEMO_DBZ.length), 2000);
    return () => window.clearInterval(id);
  }, [active, playing]);
  useEffect(() => {
    if (!active || !map || !point || !track) return;
    const echo = L.circle([point.lat, point.lon], { radius: point.radiusKm * 1000, className: `storm-demo-echo storm-${track.intensity}`, fillOpacity: 0.35, weight: 0, interactive: false }).addTo(map);
    return () => { echo.remove(); };
  }, [active, map, point, track]);
  return <>
    {active && <StormTracks map={map} tracks={tracks} />}
    <div className="storm-demo-controls">
      {!active ? <Button size="sm" variant="secondary" onClick={() => { setStep(0); setPlaying(true); setActive(true); }}><FlaskConical />{t("stormDemo")}</Button> : <>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">{t("stormSimulated")}</span>
          <Button variant="ghost" size="icon" title={t("close")} aria-label={t("close")} onClick={() => setActive(false)}><X /></Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="secondary" aria-label={playing ? t("pause") : t("play")} title={playing ? t("pause") : t("play")} onClick={() => setPlaying(v => !v)}>{playing ? <Pause /> : <Play />}</Button>
          <Button size="icon" variant="secondary" aria-label={t("stormDemoRestart")} title={t("stormDemoRestart")} onClick={() => setStep(0)}><RotateCcw /></Button>
          <span className={`storm-demo-value storm-${track?.intensity ?? "light"}`}><i />{t(LABELS[track?.intensity ?? "light"] ?? "stormLight")} · {point?.dbz} dBZ</span>
        </div>
        <input type="range" min={0} max={DEMO_DBZ.length - 1} value={step} aria-label={t("stormDemoScan")} onChange={e => { setPlaying(false); setStep(Number(e.target.value)); }} className="w-full accent-primary" />
        <span className="text-xs text-muted-foreground">{t("stormDemoScan")} {step + 1}/{DEMO_DBZ.length} · +{step * 10} min</span>
      </>}
    </div>
  </>;
}