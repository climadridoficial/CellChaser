import { useI18n, translatedProduct, translatedCountry } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RadarStation, ScanEntry, ScanFile } from "@/lib/ord";
import { countryLabel, fetchScanFiles, fetchStationScans } from "@/lib/ord";
import { decodeAndRender, type RenderedScan } from "@/lib/odim";
import AemetBackup from "@/components/AemetBackup";
import { aemetCodeFor } from "@/lib/aemet-radars";
import { legendStops, productInfo } from "@/lib/radar-products";
import { Button } from "@/components/ui/button";
import { Move } from "lucide-react";
import { AEMET_ALIGNMENT_ENABLED } from "@/lib/aemet-calibration";
import { pickFrame } from "@/lib/timeline";
import { radarFrameVisible } from "@/lib/radar-freshness";
import { OPERA_MAX_AGE_MS } from "@/lib/composite";
import { useRadarNow } from "@/hooks/use-radar-now";

const ALL_PRODUCTS = ["DBZH", "DBZV", "TH", "TV", "VRADH", "VRAD", "WRADH", "WRAD", "ZDR", "UZDR", "RHOHV", "URHOHV", "PHIDP", "UPHIDP", "KDP", "LDR", "SQIH", "CCORH", "HGHT"];
const TIME_RANGES = [
  { hours: 1, label: "1 h" },
  { hours: 3, label: "3 h" },
  { hours: 6, label: "6 h" },
  { hours: 24, label: "24 h" },
];

interface Props {
  station: RadarStation;
  apiKey: string;
  onClose: () => void;
  onScan: (scan: RenderedScan | null) => void;
  onAlignAemet: (code: string) => void;
  /** Map time slider position (null = live). */
  at: number | null;
}

/** Scan shown for the slider time: newest at or before it, else the oldest listed. */
function fileFor(list: ScanFile[], at: number | null): string | null {
  if (!list.length) return null;
  if (at === null) return list.find((f) => radarFrameVisible(f.time, null, OPERA_MAX_AGE_MS, Date.now()))?.href ?? null;
  return pickFrame(list, (f) => Date.parse(f.time), at)?.href ?? null;
}

export default function StationPanel({ station, apiKey, onClose, onScan, onAlignAemet, at }: Props) {
  const { t, locale, lang } = useI18n();
  const now = useRadarNow();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setRefresh((v) => v + 1), 10 * 60_000);
    return () => clearInterval(timer);
  }, []);
  const [scans, setScans] = useState<ScanEntry[] | null>(null);
  const [product, setProduct] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [hours, setHours] = useState(1);
  const [files, setFiles] = useState<ScanFile[] | null>(null);
  const [filesKey, setFilesKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [scan, setScan] = useState<RenderedScan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const atRef = useRef(at);
  atRef.current = at;

  // Follow the map time slider: widen the time range if needed, then pick the scan.
  useEffect(() => {
    if (at !== null) {
      const needed = (Date.now() - at) / 3600_000;
      const range = TIME_RANGES.find((r) => r.hours >= needed)?.hours ?? 24;
      setHours((h) => (h >= needed ? h : range));
    }
  }, [at]);

  // Availability for this station
  useEffect(() => {
    let cancelled = false;
    setScans(null);
    setProduct(null);
    setLevel(null);
    setFiles(null);
    setScan(null);
    onScan(null);
    setError(null);
    if (station.offline) {
      setScans([]);
      setStatus(null);
      return;
    }
    setStatus("Querying available products…");
    fetchStationScans(station.id, apiKey)
      .then((entries) => {
        if (cancelled) return;
        setScans(entries);
        const first = entries.find((e) => e.product === "DBZH") ?? entries[0] ?? null;
        setProduct(first?.product ?? null);
        setLevel(first?.level ?? null);
        setStatus(null);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setScans([]);
          setStatus(null);
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [station.id, station.offline, apiKey, onScan]);

  const availableProducts = useMemo(
    () => [...new Set((scans ?? []).map((s) => s.product))].sort(),
    [scans],
  );
  const levels = useMemo(
    () => (scans ?? []).filter((s) => s.product === product).map((s) => s.level).sort((a, b) => a - b),
    [scans, product],
  );
  const entry = useMemo(
    () => (scans ?? []).find((s) => s.product === product && s.level === level) ?? null,
    [scans, product, level],
  );
  const selectionKey = JSON.stringify([station.id, product, level, hours, apiKey]);

  // File list for product + level + time range
  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setFiles(null);
    setFilesKey(null);
    setSelectedTime(null);
    setScan(null);
    onScan(null);
    setError(null);
    setStatus("Looking up scans…");
    fetchScanFiles(
      { platform: station.id, parameterName: entry.parameterName, level: entry.level, hours },
      apiKey,
    )
      .then((list) => {
        if (cancelled) return;
        setFiles(list);
        setFilesKey(selectionKey);
        setSelectedTime(fileFor(list, atRef.current));
        setStatus(list.length ? null : "No scans published in this time range.");
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setFiles([]);
          setStatus(null);
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entry, station.id, hours, apiKey, selectionKey, onScan, refresh]);

  useEffect(() => {
    if (files && filesKey === selectionKey) setSelectedTime(fileFor(files, at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, now]);

  // Decode + render the selected scan
  useEffect(() => {
    if (filesKey !== selectionKey || !files || !selectedTime || !product || level === null) {
      setScan(null);
      onScan(null);
      return;
    }
    const file = files.find((f) => f.href === selectedTime);
    if (!file) return;
    let cancelled = false;
    setScan(null);
    onScan(null);
    setStatus("Decoding ODIM/HDF5 scan…");
    setError(null);
    decodeAndRender({
      href: file.href,
      product,
      level,
      time: file.time,
      fallbackStation: { lat: station.lat, lon: station.lon },
    })
      .then((rendered) => {
        if (cancelled) return;
        if (!radarFrameVisible(rendered.time, atRef.current, OPERA_MAX_AGE_MS, Date.now())) return;
        setScan(rendered);
        onScan(rendered);
        setStatus(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setScan(null);
        onScan(null);
        setStatus(null);
        setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [files, filesKey, selectionKey, selectedTime, product, level, station.lat, station.lon, onScan]);

  const visibleScan = scan && radarFrameVisible(scan.time, at, OPERA_MAX_AGE_MS, now) ? scan : null;
  useEffect(() => { onScan(visibleScan); }, [visibleScan, onScan]);
  const noCurrentScan = at === null && filesKey === selectionKey && !!files?.length && !fileFor(files, null);
  const info = scan?.info ?? productInfo(product ?? "DBZH");
  const backupCode = aemetCodeFor(station);
  const operaDown =
    station.offline || noCurrentScan ||
    (scans !== null && scans.length === 0) ||
    (files !== null && files.length === 0 && filesKey === selectionKey) ||
    (!!error && !scan);
  const showBackup = !!backupCode && operaDown;
  const missing = ALL_PRODUCTS.filter((p) => !availableProducts.includes(p));

  return (
    <aside className={collapsed ? "panel panel-collapsed" : "panel"}>
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={!collapsed}
        >
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
            {translatedCountry(locale, station.country, countryLabel(station.country))} · {station.offline ? t("noOpera") : t("operaStations")}
          </p>
          <h2 className="mt-1 truncate font-display text-lg leading-tight text-foreground">
            {station.name}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {product ?? "—"}
            {level !== null ? ` · ${level}°` : ""} · {collapsed ? t("expand") : t("collapse")}
          </p>
        </button>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button onClick={() => setCollapsed((v) => !v)} className="chip justify-center">
            {collapsed ? "▲" : "▼"}
          </button>
          <button onClick={onClose} className="chip justify-center" aria-label={t("close")}>
            {t("close")}
          </button>
        </div>
      </header>

      {!collapsed && (
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {AEMET_ALIGNMENT_ENABLED && backupCode && <Button variant="outline" size="sm" onClick={() => onAlignAemet(backupCode)}><Move />Alinear imagen AEMET en el mapa</Button>}
        {showBackup && backupCode && <AemetBackup code={backupCode} at={at} />}
        {!station.offline && (<>
        <section>
          <h3 className="section-title">{t("product")}</h3>
          {scans === null ? (
            <p className="hint mt-2">{t("loading")}</p>
          ) : availableProducts.length === 0 ? (
            <p className="hint mt-2">{t("noProducts")}</p>
          ) : (
            <select
              value={product ?? ""}
              onChange={(e) => {
                const p = e.target.value;
                setProduct(p);
                const next = (scans ?? []).filter((s) => s.product === p).map((s) => s.level);
                setLevel(next.sort((a, b) => a - b)[0] ?? null);
              }}
              className="select mt-2"
            >
              {availableProducts.map((p) => (
                <option key={p} value={p}>
                  {translatedProduct(lang, p)}
                </option>
              ))}
            </select>
          )}
          {missing.length > 0 && availableProducts.length > 0 && (
            <p className="hint mt-2">{t("notPublished", { p: missing.join(", ") })}</p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          <section>
            <h3 className="section-title">{t("elevation")}</h3>
            <select
              value={level ?? ""}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="select mt-2"
              disabled={levels.length === 0}
            >
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}°
                </option>
              ))}
              {levels.length === 0 && <option value="">—</option>}
            </select>
          </section>

          <section>
            <h3 className="section-title">{t("timeRange")}</h3>
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="select mt-2"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.hours} value={r.hours}>
                  {t("lastHours", { h: r.label })}
                </option>
              ))}
            </select>
          </section>
        </div>

        <section>
          <h3 className="section-title">{t("scanTime")}</h3>
          <select
            value={selectedTime ?? ""}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="select mt-2"
            disabled={at === null || !files || files.length === 0}
          >
            {(files ?? []).map((f, i) => (
              <option key={f.href} value={f.href}>
                {new Date(f.time).toLocaleString(locale, { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} UTC{i === 0 ? ` · ${t("latest")}` : ""}
              </option>
            ))}
            {(!files || files.length === 0) && <option value="">—</option>}
          </select>
        </section>

        {noCurrentScan && <p className="hint">{t("noCurrent")}</p>}
        {status && <p className="hint">{status === "Querying available products…" ? t("queryProducts") : status === "Looking up scans…" ? t("queryScans") : status === "Decoding ODIM/HDF5 scan…" ? t("decode") : status === "No scans published in this time range." ? t("noScans") : status}</p>}
        {error && <p className="alert">{t("loadFailed")}</p>}


        {scan && visibleScan && (
          <section>
            <h3 className="section-title">{translatedProduct(lang, info.key)}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <dt>{t("scanTime")}</dt>
              <dd className="text-foreground">{scan.time.slice(11, 16)} UTC</dd>
              <dt>{t("elevation")}</dt>
              <dd className="text-foreground">{scan.elangle}°</dd>
              <dt>{t("range")}</dt>
              <dd className="text-foreground">{scan.rangeKm} km</dd>
              <dt>{t("observed")}</dt>
              <dd className="text-foreground">
                {scan.min} … {scan.max} {info.unit}
              </dd>
            </dl>
            <div className="mt-3 flex overflow-hidden rounded-md">
              {legendStops(info).map((s) => (
                <div key={s.value} className="flex-1">
                  <div className="h-2.5" style={{ backgroundColor: s.css }} />
                  <span className="block pt-1 text-center text-[0.55rem] text-muted-foreground">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
        </>)}
      </div>
      )}
    </aside>
  );
}
