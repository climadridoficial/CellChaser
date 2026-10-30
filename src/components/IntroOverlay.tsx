import { useEffect, useRef, useState } from "react";
import introAsset from "@/assets/cellchaser-intro.mp4.asset.json";

const SEEN_KEY = "cellchaser.introSeen";
const FADE_MS = 700;

export default function IntroOverlay() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [closing, setClosing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Decide only after hydration so SSR stays consistent.
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = true;
    }
    setOpen(!seen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    window.setTimeout(() => setOpen(false), FADE_MS);
  };

  if (open === null || !open) return null;

  return (
    <div className={closing ? "intro-overlay intro-fade" : "intro-overlay"} role="dialog" aria-modal="true" aria-label="CellChaser">
      <video
        ref={videoRef}
        className="intro-video"
        src={introAsset.url}
        autoPlay
        muted
        playsInline
        onEnded={close}
      />
    </div>
  );
}
