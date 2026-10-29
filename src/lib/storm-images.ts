import type { EchoGrid } from "./storm-tracking";
import type { RadarBounds } from "./aemet-overlay";

// AEMET GIF legend categories (12..72 dBZ, 6 dBZ increments).
const PALETTE = new Map([
  ["0,0,252", 12], ["0,148,252", 18], ["0,252,252", 24],
  ["67,131,35", 30], ["0,192,0", 36], ["0,255,0", 42],
  ["255,255,0", 48], ["255,187,0", 54], ["255,127,0", 60],
  ["255,0,0", 66], ["200,0,90", 72],
]);
export function aemetDbz(r: number, g: number, b: number, alpha: number): number {
  return alpha > 0 ? PALETTE.get(`${r},${g},${b}`) ?? NaN : NaN;
}
/** Read ONLY outline-cleaned echoes, never the original GIF. */
export async function aemetEchoGrid(src: string, bounds: RadarBounds): Promise<EchoGrid> {
  const image = new Image(); image.src = src; await image.decode();
  const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("No canvas");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const values = new Float32Array(canvas.width * canvas.height).fill(NaN);
  for (let i = 0; i < values.length; i++) values[i] = aemetDbz(Number(pixels[i * 4]), Number(pixels[i * 4 + 1]), Number(pixels[i * 4 + 2]), Number(pixels[i * 4 + 3]));
  return { values, width: canvas.width, height: canvas.height, bounds };
}