import { useQuery } from "@tanstack/react-query";
import { aemetFrameFor, fetchAemetFrameUrl, useAemetFrames } from "@/lib/aemet-history";
import { AEMET_LIVE_MAX_AGE_MS } from "@/lib/composite";
import { formatAgo } from "@/lib/timeline";

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
  const frames = useAemetFrames(at !== null);
  const frame = at !== null ? aemetFrameFor(frames.data, code, at) : null;

  const image = useQuery({
    queryKey: at === null ? ["aemet-backup-live", code] : ["aemet-backup-frame", code, frame?.observedAt ?? null],
    enabled: at === null || !!frame,
    staleTime: at === null ? TEN_MIN : Infinity,
    refetchInterval: at === null ? TEN_MIN : false,
    retry: 2,
    queryFn: async (): Promise<{ src: string; observedAt: string | null }> => {
      if (at !== null) return { src: await fetchAemetFrameUrl(frame!), observedAt: frame!.observedAt };
      const res = await fetch(`/api/public/aemet-radar?r=${code}&t=${Math.floor(Date.now() / TEN_MIN)}`);
      if (!res.ok) throw new Error("AEMET");
      return { src: await blobToDataUrl(await res.blob()), observedAt: res.headers.get("x-observed-at") };
    },
  });

  const observed = image.data?.observedAt ? Date.parse(image.data.observedAt) : null;
  const stale = at === null && observed !== null && Date.now() - observed > AEMET_LIVE_MAX_AGE_MS;

  return (
    <section className="space-y-2">
      <p className="alert">
        ⚠️ Usando datos de respaldo de AEMET: este radar no está transmitiendo a OPERA
        (posiblemente en renovación). Reflectividad (dBZ), actualizada cada 10 min.
      </p>
      {stale && (
        <p className="alert">
          AEMET tampoco publica imágenes nuevas de este radar: la última es de{" "}
          {new Date(observed!).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{" "}
          ({formatAgo(Date.now() - observed!)}).
        </p>
      )}
      {at !== null && frames.data && !frame ? (
        <p className="hint">No hay imagen de AEMET guardada para esa hora.</p>
      ) : image.isError ? (
        <p className="hint">No se pudo cargar la imagen de AEMET. Se reintentará en 10 min.</p>
      ) : image.data ? (
        <>
          <img
            src={image.data.src}
            alt="Imagen de reflectividad del radar AEMET"
            className="w-full rounded-md border border-border"
            style={{ imageRendering: "pixelated" }}
          />
          {observed !== null && !stale && (
            <p className="hint">
              Imagen de las {new Date(observed).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} (
              {formatAgo(Date.now() - observed)}).
            </p>
          )}
        </>
      ) : (
        <p className="hint">Cargando imagen de AEMET…</p>
      )}
    </section>
  );
}
