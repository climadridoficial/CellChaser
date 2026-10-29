import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { PreloadProgress } from "@/lib/preload";
import { slotAt, slotIndex, STEPS, STEP_MS } from "@/lib/timeline";

interface Props {
  at: number | null;
  onChange: (at: number | null) => void;
  loading: boolean;
  /** Frames of the slider window already loaded; playback waits for all. */
  preload?: PreloadProgress;
  note?: string | null;
}

const PLAY_MS = 500;

export default function TimeSlider({ at, onChange, loading, preload, note }: Props) {
  const { t, locale } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const preloading = !!preload && preload.total > 0 && preload.done < preload.total;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const index = slotIndex(at, now);

  // Frames are preloaded, so every step is shown immediately while dragging.
  const onInput = (next: number) => {
    setPlaying(false);
    onChange(slotAt(next, Date.now()));
  };

  // Playback starts once the whole window is loaded, then runs smoothly.
  useEffect(() => {
    if (!playing || loading || preloading) return;
    const id = setTimeout(() => {
      const next = index >= STEPS ? 0 : index + 1;
      onChange(slotAt(next, Date.now()));
    }, index >= STEPS ? PLAY_MS * 2 : PLAY_MS);
    return () => clearTimeout(id);
  }, [playing, loading, preloading, index, onChange]);

  const shown = slotAt(index, now);
  const label =
    shown === null
      ? t("now")
      : `${new Date(shown).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} · ${t("ago", { t: `${Math.floor((now - shown) / 3600_000) ? `${Math.floor((now - shown) / 3600_000)} h ` : ""}${Math.floor((now - shown) / 60_000) % 60} min` })}`;

  return (
    <div className="time-slider" role="group" aria-label={t("timeline")}>
      <button
        type="button"
        className="time-slider-btn"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? t("pause") : t("play")}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-[0.7rem]">
          <span className="font-medium text-foreground">
            {label}
            {preloading ? (
              <span className="text-muted-foreground"> · {t("preloading", { n: preload!.done, total: preload!.total })}</span>
            ) : (
              loading && <span className="text-muted-foreground"> · {t("loading")}</span>
            )}
          </span>
          {shown !== null && (
            <button type="button" className="text-primary" onClick={() => { setPlaying(false); onChange(null); }}>
              {t("live")}
            </button>
          )}
        </div>
        {preloading && (
          <div className="h-0.5 w-full overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${(100 * preload!.done) / preload!.total}%` }} />
          </div>
        )}
        <input
          type="range"
          min={0}
          max={STEPS}
          step={1}
          value={index}
          onChange={(e) => onInput(Number(e.target.value))}
          className="time-slider-range"
          aria-label={`${t("radarTime")}: ${label}`}
          aria-valuetext={label}
        />
        <div className="flex justify-between text-[0.6rem] text-muted-foreground">
          <span>-{(STEPS * STEP_MS) / 3600_000} h</span>
          {note ? <span className="truncate px-2">{note}</span> : <span>{t("every", { n: STEP_MS / 60_000 })}</span>}
          <span>{t("now")}</span>
        </div>
      </div>
    </div>
  );
}
