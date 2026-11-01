import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { aemetFetch } from "@/lib/aemet-upstream";
import { AEMET_RADAR_CODES, OPERA_TO_AEMET } from "@/lib/aemet-radars";
import { aemetGifTime } from "@/lib/aemet-timestamp";
import { STORM_VERSION } from '@/lib/storm-version';

// Scheduled every few minutes: AEMET OpenData only serves the newest regional
// image, so we keep our own short archive for the map time slider.
const RETENTION_MS = 24 * 3600_000;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const Route = createFileRoute("/api/public/jobs/aemet-archive")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { processAemetStormFrame } = await import("@/lib/storm-pipeline.server");
        const { loadStormLightning } = await import('@/lib/storm-lightning.server');
        const lightning = await loadStormLightning();
        const cutoff = Date.now() - RETENTION_MS;
        const results: {code:string;status:string;observedAt?:string}[] = [];
        const codes = [...AEMET_RADAR_CODES];
        for (let i=0;i<codes.length;i+=2) results.push(...await Promise.all(
          codes.slice(i,i+2).map(async (code) => {
            const operaCode = Object.entries(OPERA_TO_AEMET).find(([,c])=>c===code)?.[0];
            const radarId = operaCode ? `0-724-0-${operaCode}` : `aemet-${code}`;
            try {
              const res = await aemetFetch(`red/radar/regional/${code}`);
              const bytes = new Uint8Array(await res.arrayBuffer());
              const observedAt = aemetGifTime(bytes, Date.now());
              if (!observedAt || Date.parse(observedAt)<cutoff) throw new Error("Stale or unreadable scan");
              const { error } = await supabaseAdmin.from("aemet_radar_frames").upsert(
                { code, observed_at: observedAt, path: `${code}/${observedAt}`, image_b64: toBase64(bytes) },
                { onConflict: "code,observed_at", ignoreDuplicates: true },
              );
              if (error) throw error;
              // Reuse archived observations for initial confirmation, then only
              // decode new frames. All devices read the resulting shared tracks.
              const cached = await supabaseAdmin.from("storm_cell_frames").select("observed_at").eq("radar_id",radarId).eq("source","aemet").eq("algorithm_version",STORM_VERSION).gte("observed_at",new Date(Date.parse(observedAt)-3600_000).toISOString());
              const known = new Set((cached.data??[]).map(f=>Date.parse(f.observed_at)));
              const history = await supabaseAdmin.from("aemet_radar_frames").select("observed_at,image_b64").eq("code",code).gte("observed_at",new Date(Date.parse(observedAt)-3600_000).toISOString()).lte("observed_at",observedAt).order("observed_at");
              for (const frame of history.data??[]) {
                if (known.has(Date.parse(frame.observed_at)) || !frame.image_b64) continue;
                await processAemetStormFrame(supabaseAdmin,code,frame.observed_at,Uint8Array.from(atob(frame.image_b64),c=>c.charCodeAt(0)),lightning);
              }
              // Update availability even when this observation was cached.
              await supabaseAdmin.from("storm_source_state").upsert({radar_id:radarId,source:"aemet",available:true,checked_at:new Date().toISOString()});
              return { code, status: "ok", observedAt };
            } catch (e) {
              await supabaseAdmin.from("storm_source_state").upsert({radar_id:radarId,source:"aemet",available:false,checked_at:new Date().toISOString()});
              return { code, status: `error: ${(e as Error).message}` };
            }
          }),
        ));
        await supabaseAdmin.from("aemet_radar_frames").delete().lt("observed_at", new Date(cutoff).toISOString());
        await supabaseAdmin.from("storm_cell_frames").delete().lt("observed_at",new Date(cutoff).toISOString());
        await supabaseAdmin.from("storm_track_frames").delete().lt("observed_at",new Date(cutoff).toISOString());
        return Response.json({ results });
      },
    },
  },
});
