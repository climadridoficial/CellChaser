import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import introAsset from "@/assets/cellchaser-intro.mp4.asset.json";

const SEEN_KEY = "cellchaser.introSeen";

export default function IntroOverlay() {
  const { t } = useI18n();
  const [open, setOpen] = useState<boolean | null>(null);
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
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    setOpen(false);
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
    <div className="intro-overlay" role="dialog" aria-modal="true" aria-label="CellChaser">
      <video
        ref={videoRef}
        className="intro-video"
        src={introAsset.url}
        autoPlay
        muted
        playsInline
        onEnded={close}
      />
      <div className="intro-actions">
        <button type="button" className="intro-sound" onClick={enableSound}>
          {t("introSound")}
        </button>
        <button type="button" className="intro-skip" onClick={close}>
          {t("introSkip")}
        </button>
      </div>
    </div>
  );
}
