export const TOOLBAR_POSITION_KEY = "cellchaser.toolbarPosition.v1";

/** Only vertical movement is accepted; leave room for the full toolbar. */
export function clampToolbarOffset(offset: number, baseTop: number, height: number, viewportHeight: number) {
  const minimum = -Math.max(0, baseTop);
  const maximum = Math.max(minimum, viewportHeight - height - 12 - baseTop);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(offset) ? offset : 0));
}

export function readToolbarPosition(raw: string | null): number | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch { return null; }
}