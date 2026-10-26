import type { AemetObs } from "@/lib/aemet";

const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const kmh = (ms?: number) => (ms === undefined ? undefined : Math.round(ms * 3.6));

export default function AemetPanel({ obs, onClose }: { obs: AemetObs; onClose: () => void }) {
  const rows: [string, string | undefined][] = [
    ["Temperature", obs.ta !== undefined ? `${obs.ta} °C` : undefined],
    ["Min / max", obs.tamin !== undefined && obs.tamax !== undefined ? `${obs.tamin} / ${obs.tamax} °C` : undefined],
    ["Dew point", obs.tpr !== undefined ? `${obs.tpr} °C` : undefined],
    ["Humidity", obs.hr !== undefined ? `${obs.hr} %` : undefined],
    ["Rain (1 h)", obs.prec !== undefined ? `${obs.prec} mm` : undefined],
    [
      "Wind",
      obs.vv !== undefined
        ? `${kmh(obs.vv)} km/h${obs.dv !== undefined ? ` ${DIRS[Math.round(obs.dv / 45) % 8]} (${obs.dv}°)` : ""}`
        : undefined,
    ],
    ["Gust", obs.vmax !== undefined ? `${kmh(obs.vmax)} km/h` : undefined],
    ["Pressure", obs.pres !== undefined ? `${obs.pres} hPa` : undefined],
    ["Visibility", obs.vis !== undefined ? `${obs.vis} km` : undefined],
    ["Altitude", obs.alt !== undefined ? `${obs.alt} m` : undefined],
  ];
  return (
    <aside className="panel">
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
            AEMET weather station · {obs.idema}
          </p>
          <h2 className="mt-1 truncate font-display text-lg leading-tight text-foreground">{obs.name}</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(obs.time).toUTCString().slice(5, 22)} UTC
          </p>
        </div>
        <button onClick={onClose} className="chip shrink-0" aria-label="Close weather station">
          Close
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
