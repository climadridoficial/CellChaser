import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { dedupeTracks, type StormTrack } from "./storm-tracking";
import { radarFrameVisible } from "./radar-freshness";
import { OPERA_MAX_AGE_MS, AEMET_LIVE_MAX_AGE_MS } from "./composite";

export const getSharedStormTracks = createServerFn({method:"GET"})
  .inputValidator(z.object({radarIds:z.array(z.string().regex(/^(?:0-\d+-\d+-[a-z0-9]+|aemet-[a-z]{2})$/)).max(80),at:z.number().finite().nullable(),source:z.enum(["auto","opera","aemet"])}))
  .handler(async ({data})=>{
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"], url = process.env["SUPABASE_URL"];
    if (!key || !url || !data.radarIds.length) return {tracks:[] as StormTrack[],incomplete:true};
    const client = createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization")===`Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey",key); return fetch(input,{...init,headers});
    }}});
    const now = Date.now(), end = data.at??now, start = end-60*60_000;
    const [frames,states] = await Promise.all([
      client.from("storm_track_frames").select("radar_id,source,observed_at,tracks").eq("algorithm_version",2).in("radar_id",data.radarIds).gte("observed_at",new Date(start).toISOString()).lte("observed_at",new Date(end+60_000).toISOString()).order("observed_at",{ascending:false}).limit(1000),
      client.from("storm_source_state").select("radar_id,source,available,checked_at").in("radar_id",data.radarIds),
    ]);
    if (frames.error || states.error) return {tracks:[] as StormTrack[],incomplete:true};
    const tracks: StormTrack[] = []; let missing = 0;
    for (const id of data.radarIds) {
      const row = (data.source==="auto" ? ["opera","aemet"] : [data.source]).map(source=>{
        const state = states.data?.find(s=>s.radar_id===id && s.source===source);
        const unavailable = !state?.available || now-Date.parse(state.checked_at)>15*60_000;
        return frames.data?.find(f=>f.radar_id===id&&f.source===source&&radarFrameVisible(f.observed_at,data.at,source==="opera"?OPERA_MAX_AGE_MS:AEMET_LIVE_MAX_AGE_MS,now,unavailable));
      }).find(Boolean);
      if (row) tracks.push(...row.tracks as unknown as StormTrack[]); else missing++;
    }
    return {tracks:dedupeTracks(tracks),incomplete:missing>0};
  });