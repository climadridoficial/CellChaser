// Server-only helper: calls AEMET OpenData rotating across the configured keys.
// AEMET answers inconsistently per key/request (quota, spurious "renew" errors),
// so requests rotate within priority tiers, never ahead of the preferred keys.
import { aemetKeyOrder, aemetPriorityKeys } from './aemet-key-order';

const BASE = "https://opendata.aemet.es/opendata/api/";
let turn = 0;

function keys(override?: string | null): string[] {
  const backup = (process.env["AEMET_API_KEYS"] ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const priority = aemetPriorityKeys(process.env);
  return aemetKeyOrder(priority,backup,turn++,override);
}

/** Resolves AEMET's two-step response and returns the final data response. */
export async function aemetFetch(path: string, override?: string | null): Promise<Response> {
  const pool = keys(override);
  if (!pool.length) throw new Error("No AEMET API key configured");
  let lastError = "AEMET unavailable";
  for (let round = 0; round < 3; round++) {
    for (const key of pool) {
      try {
        const res = await fetch(BASE + path, { headers: { api_key: key, Accept: "application/json" } });
        const meta = (await res.json().catch(() => null)) as { datos?: string; descripcion?: string } | null;
        if (meta?.datos?.startsWith("https://opendata.aemet.es/")) {
          const data = await fetch(meta.datos);
          if (data.ok) return data;
          lastError = `AEMET data error (${data.status})`;
        } else {
          lastError = meta?.descripcion || `AEMET error (${res.status})`;
          if (res.status === 404) throw new Error(lastError);
        }
      } catch (e) {
        lastError = (e as Error).message;
        if (/404|Error al obtener/.test(lastError)) throw e;
      }
    }
  }
  throw new Error(lastError);
}
