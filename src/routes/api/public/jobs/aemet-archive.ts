import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { aemetFetch } from "@/lib/aemet-upstream";
import { AEMET_RADAR_CODES } from "@/lib/aemet-radars";
import { aemetGifTime } from "@/lib/aemet-timestamp";

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
        const cutoff = Date.now() - RETENTION_MS;
        const results = await Promise.all(
          [...AEMET_RADAR_CODES].map(async (code) => {
            try {
              const res = await aemetFetch(`red/radar/regional/${code}`);
              const bytes = new Uint8Array(await res.arrayBuffer());
              const observedAt = aemetGifTime(bytes, Date.now());
              if (!observedAt) return { code, status: "unreadable" };
              if (Date.parse(observedAt) < cutoff) return { code, status: "stale", observedAt };
              const { error } = await supabaseAdmin.from("aemet_radar_frames").upsert(
                { code, observed_at: observedAt, path: `${code}/${observedAt}`, image_b64: toBase64(bytes) },
                { onConflict: "code,observed_at", ignoreDuplicates: true },
              );
              return { code, status: error ? `error: ${error.message}` : "ok", observedAt };
            } catch (e) {
              return { code, status: `error: ${(e as Error).message}` };
            }
          }),
        );
        await supabaseAdmin.from("aemet_radar_frames").delete().lt("observed_at", new Date(cutoff).toISOString());
        return Response.json({ results });
      },
    },
  },
});
