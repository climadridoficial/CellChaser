// Spain radar composite: which source (OPERA raw scan or AEMET OpenData image)
// draws each radar on the map.

export type CompositeMode = "off" | "opendata" | "opera-fallback" | "opera";
/** OPERA status for one radar: no OPERA station at all is `null`. */
export type OperaState = "loading" | "ok" | "missing" | "error" | null;

export const COMPOSITE_MODES: { id: CompositeMode; label: string; note: string }[] = [
  { id: "opendata", label: "Solo AEMET OpenData", note: "Los 15 radares de AEMET, cada 10 min." },
  { id: "opera-fallback", label: "OPERA y si no, OpenData", note: "Datos brutos de OPERA; AEMET si el radar no transmite." },
  { id: "opera", label: "Solo OPERA", note: "Solo radares que transmiten a OPERA." },
  { id: "off", label: "Apagado", note: "Muestra la capa de teselas elegida." },
];

export function compositeSource(mode: CompositeMode, hasAemet: boolean, opera: OperaState): "opera" | "aemet" | null {
  if (mode === "off") return null;
  // Radars without AEMET imagery (Portugal) use OPERA in every mode.
  if (mode === "opendata") return hasAemet ? "aemet" : null;
  if (opera === "ok") return "opera";
  if (mode === "opera") return null;
  // Fallback mode: wait for OPERA before falling back, so radars don't flicker.
  if (opera === "loading" || opera === "error") return null;
  return hasAemet ? "aemet" : null;
}

/** Newest scans older than this are treated as "not transmitting". */
export const OPERA_MAX_AGE_MS = 40 * 60_000;

/** Live AEMET images older than this are hidden (a broken radar's last image lingers for days). */
export const AEMET_LIVE_MAX_AGE_MS = 60 * 60_000;
