import { useEffect, useState } from "react";
import introImage from "@/assets/cellchaser-intro-30.webp.asset.json";

const SEEN_KEY = "cellchaser.introSeen";
const FADE_MS = 700;
const INTRO_MS = 3300;

// The intro is an animated image (not a video) so it always plays,
// even in iOS low-power mode, with no play button.
export default function IntroOverlay() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [closing, setClosing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
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

  // Download and decode the whole animation before showing it, so it never
  // starts playing while frames are still arriving.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const img = new Image();
    img.src = introImage.url;
    const ready = () => !cancelled && setLoaded(true);
    img.decode().then(ready, ready);
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !loaded) return;
    const id = window.setTimeout(() => {
      setClosing(true);
      try {
        window.localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* storage unavailable */
      }
      window.setTimeout(() => setOpen(false), FADE_MS);
    }, INTRO_MS);
    return () => window.clearTimeout(id);
  }, [open, loaded]);

  if (!open) return null;

  return (
    <div
      className={closing ? "intro-overlay intro-fade" : "intro-overlay"}
      role="dialog"
      aria-modal="true"
      aria-label="CellChaser"
    >
      {loaded && <img className="intro-video" src={introImage.url} alt="" />}
    </div>
  );
}
