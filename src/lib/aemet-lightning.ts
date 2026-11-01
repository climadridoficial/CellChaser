import type { Corners } from "./aemet-overlay";
import { readLightningPeriod, type LightningPeriod } from './lightning-period';

// AEMET lightning map (red/rayos/mapa): 640×480 GIF, plate-carrée projection.
// The map frame is inset at x 19–619, y 19–422; the legend sits below it.
// Saved owner alignment, copied after manual calibration on 31 Oct 2026.
export const LIGHTNING_ALIGNMENT_ENABLED = false;
export const LIGHTNING_CORNERS: Corners = [
  [44.91035917458495, -13.040771484375002], // NW
  [44.81691551782855, 6.888427734375], // NE
  [33.815666308702774, 6.866455078125001], // SE
  [33.80653802509606, -12.985839843750002], // SW
];

// Crop just inside the frame lines.
export const LIGHTNING_CROP = { x: 20, y: 20, w: 598, h: 402 };
const CROP = LIGHTNING_CROP;
export const LIGHTNING_SIZE = { w: CROP.w, h: CROP.h };

/**
 * Latest AEMET lightning-strike map as a transparent PNG data URL.
 * Black background and magenta coast/province linework are removed; the
 * coloured strike markers (age-coded) stay.
 */
export async function loadLightningImages(): Promise<{ original: string; echoes: string; period: LightningPeriod | null }> {
  const response = await fetch("/api/public/aemet-lightning");
  if (!response.ok) throw new Error("No se pudo cargar el mapa de rayos de AEMET.");
  const blobUrl = URL.createObjectURL(await response.blob());
  try {
    const img = new Image();
    img.src = blobUrl;
    await img.decode();
    if (img.naturalWidth !== 640 || img.naturalHeight !== 480) {
      throw new Error("El formato del mapa de rayos de AEMET ha cambiado.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = CROP.w;
    canvas.height = CROP.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen.");
    const full = document.createElement('canvas');
    full.width = 640; full.height = 480;
    const fullCtx = full.getContext('2d');
    if (!fullCtx) throw new Error('No se pudo leer la fecha del mapa.');
    fullCtx.drawImage(img, 0, 0);
    const period = readLightningPeriod(fullCtx.getImageData(0, 0, 640, 480).data, 640, 480, Date.now());
    ctx.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, CROP.w, CROP.h);
    const original = canvas.toDataURL("image/png");
    const pixels = ctx.getImageData(0, 0, CROP.w, CROP.h);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] ?? 0, g = d[i + 1] ?? 0, b = d[i + 2] ?? 0;
      const black = r < 40 && g < 40 && b < 40;
      const magenta = r > 180 && b > 180 && g < 120;
      d[i + 3] = black || magenta ? 0 : 255;
    }
    ctx.putImageData(pixels, 0, 0);
    return { original, echoes: canvas.toDataURL("image/png"), period };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export async function loadLightningImage(): Promise<string> {
  return (await loadLightningImages()).echoes;
}
