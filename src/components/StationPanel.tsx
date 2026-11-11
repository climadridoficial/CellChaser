import { useI18n, translatedProduct, translatedCountry } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NO_PRELOAD, runPool, type PreloadProgress } from "@/lib/preload";
import type { RadarStation, ScanEntry, ScanFile, ScanCandidate } from "@/lib/ord";
import { countryLabel, fetchScanHistory, fetchStationScans } from "@/lib/ord";
import { defaultsToLongRange, measureRadarRanges, initialRadarSelection, individualRangeOptions, individualSharedCandidate, scanRange, sharedIndividualScan, selectionCandidates, usableLevels, stationHasScans } from "@/lib/scan-availability";
import { decodeAndRender, readScanRange, type RenderedScan } from "@/lib/odim";
import AemetBackup from "@/components/AemetBackup";
import { aemetCodeFor } from "@/lib/aemet-radars";
import { legendStops, productInfo } from "@/lib/radar-products";
import { Button } from "@/components/ui/button";
import { Move } from "lucide-react";
import { AEMET_ALIGNMENT_ENABLED } from "@/lib/aemet-calibration";
import { HISTORY_HOURS, pickFrame, STEP_MS } from "@/lib/timeline";
import { radarFrameVisible } from "@/lib/radar-freshness";
import { OPERA_MAX_AGE_MS } from "@/lib/composite";
import { useRadarNow } from "@/hooks/use-radar-now";
import { OPERA_REFRESH_MS } from "@/lib/opera-refresh";
import type { AemetMapImage } from "@/lib/aemet-overlay";
import { loadFailureState } from "@/lib/load-status";

const ALL_PRODUCTS = ["DBZH", "DBZV", "TH", "TV", "VRADH", "VRAD", "WRADH", "WRAD", "ZDR", "UZDR", "RHOHV", "URHOHV", "PHIDP", "UPHIDP", "KDP", "LDR", "SQIH", "CCORH", "HGHT"];
/** History frames are lighter than the live full-detail scan, so 6 h load fast. */
const HISTORY_SIZE = 1200;
const TIME_RANGES = [
  { hours: 1, label: "1 h" },
  { hours: 3, label: "3 h" },
  { hours: 6, label: "6 h" },
  { hours: 24, label: "24 h" },
];

interface Props {
  station: RadarStation;
  sharedScan: RenderedScan | null;
  sharedCandidate: ScanCandidate | null;
  sharedHistory: ScanCandidate[] | null;
  apiKey: string;
  onClose: () => void;
  onScan: (scan: RenderedScan | null) => void;
  onBackupChange: (stationId: string, enabled: boolean) => void;
  onBackupImage: (image: AemetMapImage | null) => void;
  onAlignAemet: (code: string) => void;
  /** Map time slider position (null = live). */
  at: number | null;
  /** Reports time-slider preloading of this station's scans. */
  onPreload?: (progress: PreloadProgress) => void;
}

/** Scan shown for the slider time: newest at or before it, else the oldest listed. */
function fileFor(list: ScanFile[], at: number | null): string | null {
  if (!list.length) return null;
  if (at === null) return list.find((f) => radarFrameVisible(f.time, null, OPERA_MAX_AGE_MS, Date.now()))?.href ?? null;
  return pickFrame(list, (f) => Date.parse(f.time), at)?.href ?? null;
}

export default function StationPanel({ station, sharedScan, sharedCandidate, sharedHistory, apiKey, onClose, onScan, onBackupChange, onBackupImage, onAlignAemet, at, onPreload }: Props) {
  const { t, locale, lang } = useI18n();
  const now = useRadarNow();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setRefresh((v) => v + 1), OPERA_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  const [scans, setScans] = useState<ScanEntry[] | null>(null);
  const [product, setProduct] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  // Manual OpenData (AEMET) view for this radar, even when OPERA is up.
  const [aemetView, setAemetView] = useState(false);
  useEffect(() => { setAemetView(false); }, [station.id]);
  const [hours, setHours] = useState(1);
  const [history, setHistory] = useState<ScanCandidate[] | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [availabilityFailed, setAvailabilityFailed] = useState(false);
  const [rangeMode, setRangeMode] = useState<"short" | "long">(defaultsToLongRange(station.id) ? "long" : "short");
  const sharedStation = !station.offline;
  const inheritedCandidate = individualSharedCandidate(station.id, sharedCandidate, sharedScan);
  const [manualSelection, setManualSelection] = useState(false);
  const initialSelectionDone = useRef(false);
  const availabilityKey = JSON.stringify([station.id, hours, apiKey]);
  const currentHistory = historyKey === availabilityKey ? history : null;
  const rangeOptions = useMemo(() => individualRangeOptions(station.id, currentHistory ?? [], product), [station.id, currentHistory, product]);
  const hasBothRanges = rangeOptions.length > 1;
  const candidates = useMemo(() => currentHistory ? selectionCandidates(currentHistory, product, rangeMode, hasBothRanges) : null, [currentHistory, product, rangeMode, hasBothRanges]);
  const files = useMemo<ScanFile[] | null>(() => candidates?.filter((c) => c.level === level).map((c) => ({ href: c.href, time: c.time, bytes: null, range: scanRange(c) })) ?? null, [candidates, level]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [scan, setScan] = useState<RenderedScan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const atRef = useRef(at);
  atRef.current = at;
  // Decoded scans by file + product + elevation, so slider steps are instant.
  const cacheRef = useRef(new Map<string, Promise<RenderedScan>>());
  useEffect(() => {
    cacheRef.current.clear();
  }, [station.id]);
  const decodeCached = useCallback(
    (file: ScanFile, product: string, level: number, size?: number) => {
      const key = `${file.href}|${product}|${level}|${size ?? "full"}`;
      let hit = cacheRef.current.get(key);
      if (!hit) {
        hit = decodeAndRender({ href: file.href, product, level, time: file.time, size, fallbackStation: { lat: station.lat, lon: station.lon } });
        hit.catch(() => cacheRef.current.delete(key));
        cacheRef.current.set(key, hit);
        while (cacheRef.current.size > 120) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest === undefined) break;
          cacheRef.current.delete(oldest);
        }
      }
      return hit;
    },
    [station.lat, station.lon],
  );

  // Follow the map time slider: widen the time range if needed, then pick the scan.
  useEffect(() => {
    if (at !== null) {
      // Whole slider window at once, so moving it never re-queries.
      const needed = Math.max(HISTORY_HOURS, (Date.now() - at) / 3600_000);
      const range = TIME_RANGES.find((r) => r.hours >= needed)?.hours ?? 24;
      setHours((h) => (h >= needed ? h : range));
    }
  }, [at]);

  // Availability for this station
  useEffect(() => {
    let cancelled = false;
    setScans(null);
    initialSelectionDone.current = false;
    setManualSelection(false);
    setRangeMode(defaultsToLongRange(station.id) ? "long" : "short");
    setProduct(null);
    setLevel(null);
    setHistory(null);
    setHistoryKey(null);
    setAvailabilityFailed(false);
    setScan(null);
    onScan(null);
    setError(null);
    if (station.offline) {
      setScans([]);
      setStatus(null);
      return;
    }
    setStatus("Querying available products…");
    if (sharedStation) {
      setScans([]);
      setProduct("DBZH");
      setLevel(sharedCandidate?.level ?? 0.5);
      setStatus(null);
      return;
    }
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
    () => [...new Set([...(scans ?? []).map(s => s.product), ...(currentHistory ?? []).flatMap(c => c.products ?? [])])].sort(),
    [scans, currentHistory],
  );
  // Every elevation this radar scans (any product); ones missing for this product are shown disabled.
  const allLevels = useMemo(() => [...new Set([...(scans ?? []).map((s) => s.level), ...(currentHistory ?? []).map((c) => c.level)])].sort((a, b) => a - b), [scans, currentHistory]);
  const levels = useMemo(
    () => usableLevels(candidates ?? [], at, OPERA_MAX_AGE_MS, now),
    [candidates, at, now],
  );
  const selectionKey = JSON.stringify([availabilityKey, product, level, rangeMode]);
  const filesKey = currentHistory === null ? null : selectionKey;

  // Discover all actual volumes once; catalogue entries alone do not prove availability.
  useEffect(() => {
    if (station.offline) return;
    let cancelled = false;
    setError(null);
    setAvailabilityFailed(false);
    setStatus("Looking up scans…");
    (sharedStation && sharedHistory && hours <= HISTORY_HOURS ? Promise.resolve(sharedHistory) : fetchScanHistory(station.id, "*", hours, apiKey))
      .then(async (list) => {
        list = await measureRadarRanges(station.id, list, readScanRange);
        if (cancelled) return;
        setHistory(list);
        setHistoryKey(availabilityKey);
        setStatus(list.length ? null : "No scans published in this time range.");
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setHistory([]);
          setHistoryKey(availabilityKey);
          setAvailabilityFailed(true);
          setStatus(null);
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [station.id, station.offline, hours, apiKey, availabilityKey, refresh, sharedHistory, sharedStation]);

  useEffect(() => {
    if (currentHistory === null) return;
    if (sharedStation && !manualSelection && sharedCandidate) {
      setRangeMode(scanRange({ ...sharedCandidate, ...(sharedScan ? { rangeKm: sharedScan.rangeKm } : {}) }));
      setLevel(sharedCandidate.level);
      initialSelectionDone.current = true;
      return;
    }
    if (!initialSelectionDone.current && product) {
      const initial = initialRadarSelection(currentHistory, product, at, OPERA_MAX_AGE_MS, now, station.id);
      if (initial) {
        initialSelectionDone.current = true;
        setRangeMode(initial.range);
        setLevel(initial.level);
        return;
      }
    }
    if (level === null || !levels.includes(level)) setLevel(levels[0] ?? null);
  }, [currentHistory, levels, level, product, at, now, sharedStation, manualSelection, sharedCandidate, sharedScan]);

  useEffect(() => {
    setSelectedTime(sharedStation && !manualSelection && sharedCandidate ? sharedCandidate.href : files ? fileFor(files, at) : null);
  }, [files, at, now, sharedStation, manualSelection, sharedCandidate]);

  // Decode + render the selected scan
  useEffect(() => {
    const shared = sharedIndividualScan(station.id, sharedScan, manualSelection || aemetView, at, OPERA_MAX_AGE_MS, now);
    if (shared) {
      setScan(shared);
      onScan(shared);
      setStatus(null);
      setError(null);
      return;
    }
    if (aemetView || filesKey !== selectionKey || !files || !selectedTime || !product || level === null) {
      setScan(null);
      onScan(null);
      return;
    }
    const file = files.find((f) => f.href === selectedTime);
    if (!file) return;
    let cancelled = false;
    // Keep the current image on screen until the next one is decoded.
    setStatus("Decoding ODIM/HDF5 scan…");
    setError(null);
    decodeCached(file, product, level, atRef.current === null ? undefined : HISTORY_SIZE)
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
  }, [files, filesKey, selectionKey, selectedTime, product, level, decodeCached, onScan, sharedStation, manualSelection, sharedScan, aemetView, at, now, station.id]);

  // History mode: decode every scan in the slider window once.
  const historyMode = at !== null;
  useEffect(() => {
    const report = onPreload ?? (() => {});
    if (aemetView || !historyMode || !files || filesKey !== selectionKey || !product || level === null) {
      report(NO_PRELOAD);
      return;
    }
    // Only scans from the slider position onwards (towards live), nearest first.
    const since = Math.max(Date.now() - (HISTORY_HOURS + 0.5) * 3600_000, (at ?? Date.now()) - STEP_MS);
    const todo = files.filter((f) => Date.parse(f.time) > since).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    let cancelled = false;
    let done = 0;
    report({ done, total: todo.length });
    void runPool(todo.map((f) => () => decodeCached(f, product, level, HISTORY_SIZE)), 3, () => {
      done++;
      report({ done, total: todo.length });
    }, () => cancelled);
    return () => {
      cancelled = true;
      report(NO_PRELOAD);
    };
  }, [historyMode, at, files, filesKey, selectionKey, product, level, decodeCached, onPreload]);

  const visibleScan = !aemetView && scan && radarFrameVisible(scan.time, at, OPERA_MAX_AGE_MS, now) ? scan : null;
  useEffect(() => { onScan(visibleScan); }, [visibleScan, onScan]);
  const noCurrentScan = at === null && filesKey === selectionKey && !!files?.length && !fileFor(files, null);
  const info = scan?.info ?? productInfo(product ?? "DBZH");
  const backupCode = aemetCodeFor(station);
  const operaDown =
    station.offline ||
    (!visibleScan && !availabilityFailed && currentHistory !== null && !stationHasScans(currentHistory, at, OPERA_MAX_AGE_MS, now));
  const showBackup = !!backupCode && (operaDown || aemetView);
  useEffect(() => { onBackupChange(station.id, showBackup); }, [station.id, showBackup, onBackupChange]);
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
        {backupCode && !station.offline && (
          <Button variant={aemetView ? "default" : "outline"} size="sm" onClick={() => setAemetView((v) => !v)}>
            {aemetView ? t("viewOpera") : t("viewAemet")}
          </Button>
        )}
        {showBackup && backupCode && <AemetBackup code={backupCode} at={at} manual={aemetView && !operaDown} onMapImage={onBackupImage} />}
        {!station.offline && !aemetView && (<>
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
                setManualSelection(true);
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

        {hasBothRanges && (
          <section>
            <h3 className="section-title">{t("rangeTitle")}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={t("rangeTitle")}>
              {rangeOptions.map(range => (
                <Button key={range} className="h-auto min-h-16 whitespace-normal leading-tight" variant={rangeMode === range ? "default" : "outline"} size="sm" aria-pressed={rangeMode === range} onClick={() => { setManualSelection(true); initialSelectionDone.current = true; setRangeMode(range); }}>
                  {t(range === "short" ? "rangeShort" : "rangeLong")}
                </Button>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <section>
            <h3 className="section-title">{t("elevation")}</h3>
            <select
              value={level ?? ""}
              onChange={(e) => { setManualSelection(true); setLevel(Number(e.target.value)); }}
              className="select mt-2"
              disabled={levels.length === 0}
            >
              {allLevels.map((l) => (
                <option key={l} value={l} disabled={!levels.includes(l)}>
                  {l}°{levels.includes(l) ? "" : ` (${t("levelUnavailable")})`}
                </option>
              ))}
              {levels.length === 0 && <option value="">—</option>}
            </select>
          </section>

          <section>
            <h3 className="section-title">{t("timeRange")}</h3>
            <select
              value={hours}
              onChange={(e) => { setManualSelection(true); setHours(Number(e.target.value)); }}
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
            onChange={(e) => { setManualSelection(true); setSelectedTime(e.target.value); }}
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

        {(noCurrentScan || (currentHistory !== null && levels.length === 0)) && <p className="hint">{at === null ? t("noCurrent") : t("noScans")}</p>}
        {status && <p className="hint">{status === "Querying available products…" ? t("queryProducts") : status === "Looking up scans…" ? t("queryScans") : status === "Decoding ODIM/HDF5 scan…" ? t("decode") : status === "No scans published in this time range." ? t("noScans") : status}</p>}
        {error && <p className="alert">{t(loadFailureState(true, visibleScan ? 1 : 0) === "partial" ? "scanUpdateFailed" : "operaFailed")}</p>}


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
