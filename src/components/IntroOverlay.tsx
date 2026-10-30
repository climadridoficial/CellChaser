import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import introAsset from "@/assets/cellchaser-intro.mp4.asset.json";

const SEEN_KEY = "cellchaser.introSeen";
const FADE_MS = 700;

export default function IntroOverlay() {
  const { t } = useI18n();
  const [open, setOpen] = useState<boolean | null>(null);
  const [closing, setClosing] = useState(false);
  const [needsSound, setNeedsSound] = useState(false);
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

  const markSeen = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  };

  // Fade out, then unmount once the transition is done.
  const close = () => {
    if (closing) return;
    setClosing(true);
    markSeen();
    window.setTimeout(() => setOpen(false), FADE_MS);
  };

  const start = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video
      .play()
      .then(() => setNeedsSound(false))
      .catch(() => {
        // Browsers block unmuted autoplay until the user interacts.
        video.muted = true;
        setNeedsSound(true);
        void video.play().catch(() => {});
      });
  };

  const enableSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    void video.play().catch(() => {});
  };

  if (open === null || !open) return null;

  return (
    <div
      className={closing ? "intro-overlay intro-fade" : "intro-overlay"}
      role="dialog"
      aria-modal="true"
      aria-label="CellChaser"
      onTransitionEnd={undefined}
    >
      <video
        ref={(node) => {
          videoRef.current = node;
          if (node) start();
        }}
        className="intro-video"
        src={introAsset.url}
        autoPlay
        playsInline
        onEnded={close}
      />
      <div className="intro-actions">
        {needsSound && (
          <button type="button" className="intro-sound" onClick={enableSound}>
            {t("introSound")}
          </button>
        )}
        <button type="button" className="intro-skip" onClick={close}>
          {t("introSkip")}
        </button>
      </div>
    </div>
  );
}
