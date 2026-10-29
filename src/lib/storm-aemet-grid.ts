import outlines from "./aemet-outline-data.json";
import { decodeGif } from "./aemet-timestamp";
import { maskEchoPixels, removeOutlines, outlineMismatch } from "./aemet-overlay";
import { aemetDbz } from "./storm-images";
import { AEMET_CALIBRATION } from "./aemet-calibration";
import type { EchoGrid } from "./storm-tracking";

/** Same validated crop and outline maps as the display, with no browser canvas. */
export function aemetStormGrid(code: string, bytes: Uint8Array): EchoGrid {
  const {width,height,rgba} = decodeGif(bytes), bounds = AEMET_CALIBRATION[code];
  if (width!==480 || height!==530 || !bounds) throw new Error("Uncalibrated AEMET layout");
  const cropped = new Uint8ClampedArray(rgba.slice(20*width*4,480*width*4));
  const outline = new Uint8Array(480*460);
  const ids = (outlines as Record<string,number[]>)[code];
  for (const i of ids ?? []) outline[i]=1;
  const clean = ids && outlineMismatch(cropped,outline)<0.2 ? removeOutlines(cropped,480,460,outline) : maskEchoPixels(cropped,480,460);
  const values = new Float32Array(480*460).fill(NaN);
  for (let i=0;i<values.length;i++) values[i]=aemetDbz(Number(clean[i*4]),Number(clean[i*4+1]),Number(clean[i*4+2]),Number(clean[i*4+3]));
  return {values,width:480,height:460,bounds};
}