import { useI18n } from "@/lib/i18n";
import type { AemetObs } from "@/lib/aemet";

const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const kmh = (ms?: number) => (ms === undefined ? undefined : Math.round(ms * 3.6));

export default function AemetPanel({ obs, onClose }: { obs: AemetObs; onClose: () => void }) {
  const { t, locale } = useI18n();
  const rows: [string, string | undefined][] = [
    [t("temperature"), obs.ta !== undefined ? `${obs.ta} °C` : undefined],
    [t("minmax"), obs.tamin !== undefined && obs.tamax !== undefined ? `${obs.tamin} / ${obs.tamax} °C` : undefined],
    [t("dew"), obs.tpr !== undefined ? `${obs.tpr} °C` : undefined],
    [t("humidity"), obs.hr !== undefined ? `${obs.hr} %` : undefined],
    [t("rain"), obs.prec !== undefined ? `${obs.prec} mm` : undefined],
    [
      t("wind"),
      obs.vv !== undefined
        ? `${kmh(obs.vv)} km/h${obs.dv !== undefined ? ` ${DIRS[Math.round(obs.dv / 45) % 8]} (${obs.dv}°)` : ""}`
        : undefined,
    ],
    [t("gust"), obs.vmax !== undefined ? `${kmh(obs.vmax)} km/h` : undefined],
    [t("pressure"), obs.pres !== undefined ? `${obs.pres} hPa` : undefined],
    [t("visibility"), obs.vis !== undefined ? `${obs.vis} km` : undefined],
    [t("altitude"), obs.alt !== undefined ? `${obs.alt} m` : undefined],
  ];
  return (
    <aside className="panel">
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
            {t("weatherStation")} · {obs.idema}
          </p>
          <h2 className="mt-1 truncate font-display text-lg leading-tight text-foreground">{obs.name}</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(obs.time).toLocaleString(locale, { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} UTC
          </p>
        </div>
        <button onClick={onClose} className="chip shrink-0" aria-label={t("close")}>
          {t("close")}
        </button>
      </header>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto px-5 py-4 text-sm text-muted-foreground">
        {rows
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt>{k}</dt>
              <dd className="text-foreground">{v}</dd>
            </div>
          ))}
      </dl>
    </aside>
  );
}
