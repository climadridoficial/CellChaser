import { useEffect, useState } from "react";

const TEN_MIN = 10 * 60_000;

export default function AemetBackup({ code }: { code: string }) {
  const [tick, setTick] = useState(() => Math.floor(Date.now() / TEN_MIN));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setFailed(false);
      setTick(Math.floor(Date.now() / TEN_MIN));
    }, TEN_MIN);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="space-y-2">
      <p className="alert">
        ⚠️ Usando datos de respaldo de AEMET: este radar no está transmitiendo a OPERA
        (posiblemente en renovación). Reflectividad (dBZ), actualizada cada 10 min.
      </p>
      {failed ? (
        <p className="hint">No se pudo cargar la imagen de AEMET. Se reintentará en 10 min.</p>
      ) : (
        <img
          key={tick}
          src={`/api/public/aemet-radar?r=${code}&t=${tick}`}
          alt="Imagen de reflectividad del radar AEMET"
          className="w-full rounded-md border border-border"
          style={{ imageRendering: "pixelated" }}
          onError={() => setFailed(true)}
        />
      )}
    </section>
  );
}
