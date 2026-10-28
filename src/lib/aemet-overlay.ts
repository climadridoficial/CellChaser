export const AEMET_REFRESH_MS = 10 * 60_000;
export type RadarBounds = [[number, number], [number, number]];
export interface AemetMapImage {
  code: string;
  image: string;
  bounds: RadarBounds;
  editing: boolean;
  opacity: number;
}

export function validBounds(value: RadarBounds): boolean {
  const [[s, w], [n, e]] = value;
  return [s, w, n, e].every(Number.isFinite) && s >= -85 && n <= 85 && w >= -180 && e <= 180 && s < n && w < e;
}

// These are starting handles, not an asserted geographic calibration.
export function initialBounds(lat: number, lon: number): RadarBounds {
  const dy = 240 / 111.32;
  const dx = dy / Math.cos(lat * Math.PI / 180);
  return [[lat - dy, lon - dx], [lat + dy, lon + dx]];
}

const ECHO_COLOURS = new Set([
  '0,0,252', '0,148,252', '0,252,252', '0,192,0', '0,255,0',
  '255,255,0', '255,187,0', '255,127,0', '255,0,0', '200,0,90', '67,131,35',
]);

/** The GIF uses the same yellow for outlines and echoes. Suppress thin yellow
 * linework conservatively; yellow touching other echoes or in solid blocks stays.
 * Pixels hidden by AEMET's original outlines cannot be reconstructed.
 */
export function maskEchoPixels(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(data);
  const colour = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return '';
    const i = (y * width + x) * 4;
    return `${data[i]},${data[i + 1]},${data[i + 2]}`;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = colour(x, y);
      let keep = ECHO_COLOURS.has(rgb);
      if (rgb === '255,255,0') {
        let neighbourEcho = false;
        let block = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const c = colour(x + dx, y + dy);
          if (c !== '255,255,0' && ECHO_COLOURS.has(c)) neighbourEcho = true;
        }
        for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
          if ([colour(x + dx, y), colour(x, y + dy), colour(x + dx, y + dy)].every(c => c === rgb)) block = true;
        }
        keep = neighbourEcho || block;
      }
      output[(y * width + x) * 4 + 3] = keep ? 255 : 0;
    }
  }
  return output;
}

export async function loadAemetImages(code: string, tick: number): Promise<{ original: string; echoes: string }> {
  const response = await fetch(`/api/public/aemet-radar?r=${encodeURIComponent(code)}&t=${tick}`);
  if (!response.ok) throw new Error('No se pudo cargar la imagen de AEMET.');
  const blobUrl = URL.createObjectURL(await response.blob());
  try {
    const img = new Image();
    img.src = blobUrl;
    await img.decode();
    if (img.naturalWidth !== 480 || img.naturalHeight !== 530) throw new Error('El formato de la imagen de AEMET ha cambiado; no se aplicará una alineación incorrecta.');
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 460;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen.');
    // Same crop in alignment and echo mode: no header, footer or colour legend.
    ctx.drawImage(img, 0, 20, 480, 460, 0, 0, 480, 460);
    const original = canvas.toDataURL('image/png');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    pixels.data.set(maskEchoPixels(pixels.data, canvas.width, canvas.height));
    ctx.putImageData(pixels, 0, 0);
    return { original, echoes: canvas.toDataURL('image/png') };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}