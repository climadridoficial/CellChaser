import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatAgo, slotAt, slotIndex, STEPS, STEP_MS } from "@/lib/timeline";

interface Props {
  at: number | null;
  onChange: (at: number | null) => void;
  loading: boolean;
  note?: string | null;
}

const PLAY_MS = 700;
const COMMIT_MS = 250;

export default function TimeSlider({ at, onChange, loading, note }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const commitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const index = draft ?? slotIndex(at, now);

  // Dragging only loads the position the finger stops on.
  const onInput = (next: number) => {
    setPlaying(false);
    setDraft(next);
    if (commitRef.current) clearTimeout(commitRef.current);
    commitRef.current = setTimeout(() => {
      setDraft(null);
      onChange(slotAt(next, Date.now()));
    }, COMMIT_MS);
  };

  // Playback advances only once the current frame has loaded.
  useEffect(() => {
    if (!playing || loading) return;
    const id = setTimeout(() => {
      const next = index >= STEPS ? 0 : index + 1;
      onChange(slotAt(next, Date.now()));
    }, index >= STEPS ? PLAY_MS * 2 : PLAY_MS);
    return () => clearTimeout(id);
  }, [playing, loading, index, onChange]);

  const shown = slotAt(index, now);
  const label =
    shown === null
      ? "Ahora"
      : `${new Date(shown).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · ${formatAgo(now - shown)}`;

  return (
    <div className="time-slider" role="group" aria-label="Línea de tiempo del radar">
      <button
        type="button"
        className="time-slider-btn"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Pausar animación" : "Reproducir las últimas horas"}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-[0.7rem]">
          <span className="font-medium text-foreground">
            {label}
            {loading && <span className="text-muted-foreground"> · cargando…</span>}
          </span>
          {shown !== null && (
            <button type="button" className="text-primary" onClick={() => { setPlaying(false); onChange(null); }}>
              En directo
            </button>
          )}
        </div>
        <input
          type="range"
          min={0}
          max={STEPS}
          step={1}
          value={index}
          onChange={(e) => onInput(Number(e.target.value))}
          className="time-slider-range"
          aria-label={`Hora del radar: ${label}`}
          aria-valuetext={label}
        />
        <div className="flex justify-between text-[0.6rem] text-muted-foreground">
          <span>-{(STEPS * STEP_MS) / 3600_000} h</span>
          {note ? <span className="truncate px-2">{note}</span> : <span>cada {STEP_MS / 60_000} min</span>}
          <span>ahora</span>
        </div>
      </div>
    </div>
  );
}
