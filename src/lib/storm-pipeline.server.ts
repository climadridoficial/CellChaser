import { IBERIA, fetchStations, fetchScanHistory, pickScan } from "./ord";
import { detectCells, confirmedStormTracks, type Cell, type CellFrame } from "./storm-tracking";
import { operaStormGrid } from "./storm-grid";
import { aemetStormGrid } from "./storm-aemet-grid";
import { OPERA_TO_AEMET } from "./aemet-radars";
import { OPERA_MAX_AGE_MS } from "./composite";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { STORM_VERSION } from './storm-version';
import { buildStormAdvisory, type LightningEvidence, type VelocityEvidence } from './storm-advisory';
import { loadStormLightning } from './storm-lightning.server';
import { fetchStormVolume } from './storm-ingest.server';

export { STORM_VERSION } from './storm-version';
type Client = SupabaseClient<Database>;
export async function saveStormFrame(client: Client, radarId: string, source: "opera"|"aemet", time: string, cells: Cell[], context: {level?:number;velocity?:VelocityEvidence|null;lightning?:LightningEvidence|null} = {}) {
  const inserted = await client.from("storm_cell_frames").upsert({radar_id:radarId,source,observed_at:time,cells:cells as unknown as Json,algorithm_version:STORM_VERSION});
  if (inserted.error) throw inserted.error;
  const history = await client.from("storm_cell_frames").select("observed_at,cells").eq("radar_id",radarId).eq("source",source).eq("algorithm_version",STORM_VERSION).gte("observed_at",new Date(Date.parse(time)-3600_000).toISOString()).lte("observed_at",time).order("observed_at");
  if (history.error) throw history.error;
  const frames: CellFrame[] = (history.data??[]).map(f=>({time:Date.parse(f.observed_at),cells:f.cells as unknown as Cell[]}));
  const tracks = confirmedStormTracks(frames,`${source}-${radarId}`).map(track=>({...track,advisory:buildStormAdvisory(track,source,context.level??0,context.velocity,context.lightning)}));
  const saved = await client.from("storm_track_frames").upsert({radar_id:radarId,source,observed_at:time,tracks:tracks as unknown as Json,algorithm_version:STORM_VERSION});
  if (saved.error) throw saved.error;
}

export async function processAemetStormFrame(client: Client, code: string, time: string, bytes: Uint8Array, lightning?: LightningEvidence|null) {
  const opera = Object.entries(OPERA_TO_AEMET).find(([,c])=>c===code)?.[0];
  const id = opera ? `0-724-0-${opera}` : `aemet-${code}`;
  await saveStormFrame(client,id,"aemet",time,detectCells(aemetStormGrid(code,bytes)),{lightning:lightning??null});
  await client.from("storm_source_state").upsert({radar_id:id,source:"aemet",available:true,checked_at:new Date().toISOString()});
}

/** Scheduled ingest, not a per-viewer computation. Concurrency stays below six. */
export async function refreshOperaStorms(client: Client, part = 0, parts = 1) {
  const lightning = await loadStormLightning();
  // Split across several scheduled requests: one request has a limited number of outbound calls.
  const stations = (await fetchStations()).filter(s=>IBERIA.includes(s.country.replace(/^0+/,""))).sort((a,b)=>a.id.localeCompare(b.id)).filter((_,i)=>i%parts===part);
  const results: {radarId:string;ok:boolean;error?:string}[] = [];
  for (let i=0;i<stations.length;i+=2) {
    await Promise.all(stations.slice(i,i+2).map(async station=>{
      let sourceVerified = false;
      try {
        const history = await fetchScanHistory(station.id,"DBZH",1.5);
        const current = pickScan(history,Date.now(),OPERA_MAX_AGE_MS);
        if (!current) throw new Error("No fresh radar scan");
        const cached = await client.from("storm_cell_frames").select("observed_at").eq("radar_id",station.id).eq("source","opera").eq("algorithm_version",STORM_VERSION).gte("observed_at",new Date(Date.now()-90*60_000).toISOString());
        if (cached.error) throw cached.error;
        const known = new Set((cached.data??[]).map(f=>Date.parse(f.observed_at)));
        sourceVerified = known.has(Date.parse(current.time));
        const times = [...new Set(history.map(f=>Date.parse(f.time)))].filter(t=>t<=Date.parse(current.time)&&t>=Date.parse(current.time)-3600_000).sort((a,b)=>a-b).slice(-3);
        for (const t of times) {
          if (known.has(t)) continue;
          const pick = pickScan(history.filter(f=>Date.parse(f.time)===t),t,60_000);
          if (!pick) continue;
          const buffer = await fetchStormVolume(pick.href);
          if (t === Date.parse(current.time)) sourceVerified = true;
          const cells=detectCells(await operaStormGrid(buffer,pick.level,station));
          let velocity: VelocityEvidence|null=null;
          if (cells.length) {
            // Reuse same-time DBZH volume; Doppler short-range volume if separate.
            // One extra download per scan, NEVER one per cell; don't query ORD again.
            const doppler=history.find(f=>f.doppler && f.time===pick.time && Math.abs(f.level-pick.level)<=0.01);
            try {
              let velocityBuffer=buffer;
              if (doppler && doppler.href!==pick.href) {
                velocityBuffer = await fetchStormVolume(doppler.href);
              }
              velocity={grid:await operaStormGrid(velocityBuffer,pick.level,station,['VRADH','VRAD','VRADV'],true),time:t,level:pick.level,quantity:'VRAD'};
            } catch { /* Missing VRAD never suppresses reflectivity forecasts. */ }
          }
          await saveStormFrame(client,station.id,"opera",pick.time,cells,{level:pick.level,velocity,lightning});
        }
        await client.from("storm_source_state").upsert({radar_id:station.id,source:"opera",available:true,checked_at:new Date().toISOString()});
        results.push({radarId:station.id,ok:true});
      } catch (e) {
        console.error("OPERA storm refresh failed", station.id, (e as Error).message);
        await client.from("storm_source_state").upsert({radar_id:station.id,source:"opera",available:sourceVerified,checked_at:new Date().toISOString()});
        results.push({radarId:station.id,ok:false,error:(e as Error).message});
      }
    }));
  }
  return results;
}