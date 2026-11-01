import { aemetFetch } from './aemet-upstream';
import { decodeGif } from './aemet-timestamp';
import { readLightningPeriod } from './lightning-period';
import { LIGHTNING_CORNERS, LIGHTNING_CROP } from './aemet-lightning';
import type { LightningEvidence } from './storm-advisory';

/** One fetch per scheduled run, shared across its radar cells; never per viewer. */
export async function loadStormLightning(): Promise<LightningEvidence | null> {
  try {
    const response=await aemetFetch('red/rayos/mapa');
    const {width,height,rgba}=decodeGif(new Uint8Array(await response.arrayBuffer()));
    const period=readLightningPeriod(rgba,width,height,Date.now());
    if (!period || width!==640 || height!==480) return null;
    const pixels: [number,number][]=[];
    for(let y=0;y<LIGHTNING_CROP.h;y++) for(let x=0;x<LIGHTNING_CROP.w;x++) {
      const i=((y+LIGHTNING_CROP.y)*width+x+LIGHTNING_CROP.x)*4;
      // Only yellow, the newest two-hour interval. Black/magenta outlines never match.
      if ((rgba[i]??0)>225 && (rgba[i+1]??0)>225 && (rgba[i+2]??255)<30) pixels.push([x+0.5,y+0.5]);
    }
    return {period,pixels,corners:LIGHTNING_CORNERS,width:LIGHTNING_CROP.w,height:LIGHTNING_CROP.h};
  } catch (error) {
    console.warn('Storm lightning context unavailable',error instanceof Error?error.message:'Unknown error');
    return null;
  }
}