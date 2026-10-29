import { fetchStations, fetchScanHistory, pickScan } from "./ord";
import { detectCells, confirmedStormTracks, type Cell, type CellFrame } from "./storm-tracking";
import { operaStormGrid } from "./storm-grid";
import { aemetStormGrid } from "./storm-aemet-grid";
import { OPERA_TO_AEMET } from "./aemet-radars";
import { OPERA_MAX_AGE_MS } from "./composite";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export const STORM_VERSION = 2;
type Client = SupabaseClient<Database>;
export async function saveStormFrame(client: Client, radarId: string, source: "opera"|"aemet", time: string, cells: Cell[]) {
  const inserted = await client.from("storm_cell_frames").upsert({radar_id:radarId,source,observed_at:time,cells:cells as unknown as Json,algorithm_version:STORM_VERSION});
  if (inserted.error) throw inserted.error;
  const history = await client.from("storm_cell_frames").select("observed_at,cells").eq("radar_id",radarId).eq("source",source).eq("algorithm_version",STORM_VERSION).gte("observed_at",new Date(Date.parse(time)-3600_000).toISOString()).lte("observed_at",time).order("observed_at");
  if (history.error) throw history.error;
  const frames: CellFrame[] = (history.data??[]).map(f=>({time:Date.parse(f.observed_at),cells:f.cells as unknown as Cell[]}));
  const tracks = confirmedStormTracks(frames,`${source}-${radarId}`);
  const saved = await client.from("storm_track_frames").upsert({radar_id:radarId,source,observed_at:time,tracks:tracks as unknown as Json,algorithm_version:STORM_VERSION});
  if (saved.error) throw saved.error;
}

export async function processAemetStormFrame(client: Client, code: string, time: string, bytes: Uint8Array) {
  const opera = Object.entries(OPERA_TO_AEMET).find(([,c])=>c===code)?.[0];
  const id = opera ? `0-724-0-${opera}` : `aemet-${code}`;
  await saveStormFrame(client,id,"aemet",time,detectCells(aemetStormGrid(code,bytes)));
  await client.from("storm_source_state").upsert({radar_id:id,source:"aemet",available:true,checked_at:new Date().toISOString()});
}

/** Scheduled ingest, not a per-viewer computation. Concurrency stays below six. */
export async function refreshOperaStorms(client: Client) {
  const stations = (await fetchStations()).filter(s=>IBERIA.includes(s.country.replace(/^0+/,"")));
  const results: {radarId:string;ok:boolean}[] = [];
  for (let i=0;i<stations.length;i+=2) {
    await Promise.all(stations.slice(i,i+2).map(async station=>{
      try {
        const history = await fetchScanHistory(station.id,"DBZH",1.5);
        const current = pickScan(history,Date.now(),OPERA_MAX_AGE_MS);
        if (!current) throw new Error("No fresh radar scan");
        const cached = await client.from("storm_cell_frames").select("observed_at").eq("radar_id",station.id).eq("source","opera").eq("algorithm_version",STORM_VERSION).gte("observed_at",new Date(Date.now()-90*60_000).toISOString());
        if (cached.error) throw cached.error;
        const known = new Set((cached.data??[]).map(f=>Date.parse(f.observed_at)));
        const times = [...new Set(history.map(f=>Date.parse(f.time)))].filter(t=>t<=Date.parse(current.time)&&t>=Date.parse(current.time)-3600_000).sort((a,b)=>a-b);
        for (const t of times) {
          if (known.has(t)) continue;
          const pick = pickScan(history.filter(f=>Date.parse(f.time)===t),t,60_000);
          if (!pick) continue;
          const url = new URL(pick.href);
          if (url.protocol!=="https:" || !["s3.waw3-1.cloudferro.com","api.meteogate.eu","radar.meteogate.eu"].includes(url.hostname)) throw new Error("Untrusted radar host");
          const response = await fetch(url,{redirect:"error",signal:AbortSignal.timeout(25_000)});
          if (!response.ok) throw new Error("Radar download unavailable");
          await saveStormFrame(client,station.id,"opera",pick.time,detectCells(await operaStormGrid(await response.arrayBuffer(),pick.level,station)));
        }
        await client.from("storm_source_state").upsert({radar_id:station.id,source:"opera",available:true,checked_at:new Date().toISOString()});
        results.push({radarId:station.id,ok:true});
      } catch {
        await client.from("storm_source_state").upsert({radar_id:station.id,source:"opera",available:false,checked_at:new Date().toISOString()});
        results.push({radarId:station.id,ok:false});
      }
    }));
  }
  return results;
}