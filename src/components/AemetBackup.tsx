import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { aemetFrameFor, fetchAemetFrameUrl, useAemetFrames } from "@/lib/aemet-history";
import { AEMET_LIVE_MAX_AGE_MS } from "@/lib/composite";
import { radarFrameVisible } from "@/lib/radar-freshness";
import { useRadarNow } from "@/hooks/use-radar-now";

const TEN_MIN = 10 * 60_000;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function AemetBackup({ code, at }: { code: string; at: number | null }) {
  const { t, locale } = useI18n();
  const now = useRadarNow();
  const frames = useAemetFrames(at !== null);
  const frame = at !== null ? aemetFrameFor(frames.data, code, at) : null;

  const image = useQuery({
    queryKey: at === null ? ["aemet-backup-live", code] : ["aemet-backup-frame", code, frame?.observedAt ?? null],
    enabled: at === null || !!frame,
    staleTime: at === null ? TEN_MIN : Infinity,
    refetchInterval: at === null ? TEN_MIN : false,
    retry: 2,
    queryFn: async (): Promise<{ src: string; observedAt: string | null }> => {
      if (at !== null) {
        if (!frame) throw new Error("No archived frame");
        return { src: await fetchAemetFrameUrl(frame), observedAt: frame.observedAt };
      }
      const res = await fetch(`/api/public/aemet-radar?r=${code}&t=${Math.floor(Date.now() / TEN_MIN)}`);
      if (!res.ok) throw new Error("AEMET");
      return { src: await blobToDataUrl(await res.blob()), observedAt: res.headers.get("x-observed-at") };
    },
  });

  const observed = image.data?.observedAt ? Date.parse(image.data.observedAt) : null;
  const visible = !!image.data && radarFrameVisible(image.data.observedAt, at, AEMET_LIVE_MAX_AGE_MS, now, image.isError);
  const stale = at === null && !!image.data && !visible;

  return (
    <section className="space-y-2">
      <p className="alert">
        {t("backupWarning")}
      </p>
      {stale && (
        <p className="alert">
          {t("noCurrent")}
        </p>
      )}
      {at !== null && frames.data && !frame ? (
        <p className="hint">{t("noSaved")}</p>
      ) : image.isError ? (
        <p className="hint">{t("aemetError")}</p>
      ) : image.data && visible ? (
        <>
          <img
            src={image.data.src}
            alt={t("aemetImage")}
            className="w-full rounded-md border border-border"
            style={{ imageRendering: "pixelated" }}
          />
          {observed !== null && !stale && (
            <p className="hint">
              {t("imageAt", { time: new Date(observed).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) })} (
              {t("ago", { t: `${Math.round((now - observed) / 60_000)} min` })}).
            </p>
          )}
        </>
      ) : (
        <p className="hint">{t("noCurrent")}</p>
      )}
    </section>
  );
}
