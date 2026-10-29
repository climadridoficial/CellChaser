import { createFileRoute } from "@tanstack/react-router";
import { aemetFetch } from "@/lib/aemet-upstream";
import { AEMET_RADAR_CODES } from "@/lib/aemet-radars";
import { aemetGifTime } from "@/lib/aemet-timestamp";

// Latest AEMET regional reflectivity image (GIF) for one radar. The time
// printed on the image goes out as X-Observed-At so stale frames can be hidden.
// AEMET OpenData fails intermittently (rate-limited keys), so a failed fetch
// falls back to the newest archived frame instead of an error.

const ARCHIVE_FALLBACK_MS = 60 * 60_000;

function gifResponse(bytes: Uint8Array<ArrayBuffer>, observed: string | null, source: "live" | "archive") {
  const headers: Record<string, string> = {
    "Content-Type": "image/gif",
    "Cache-Control": source === "live" ? "public, max-age=300" : "no-store",
    "X-Source": source,
  };
  if (observed) headers["X-Observed-At"] = observed;
  return new Response(bytes, { headers });
}

async function archivedFrame(code: string): Promise<Response | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - ARCHIVE_FALLBACK_MS).toISOString();
    const { data } = await supabaseAdmin
      .from("aemet_radar_frames")
      .select("observed_at, image_b64")
      .eq("code", code)
      .gte("observed_at", since)
      .not("image_b64", "is", null)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.image_b64) return null;
    const bytes = Uint8Array.from(atob(data.image_b64), (c) => c.charCodeAt(0));
    return gifResponse(bytes, new Date(data.observed_at).toISOString().replace(".000Z", "Z"), "archive");
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/aemet-radar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = new URL(request.url).searchParams.get("r") ?? "";
        if (!AEMET_RADAR_CODES.has(code)) return new Response("Unknown radar", { status: 400 });
        try {
          const data = await aemetFetch(`red/radar/regional/${code}`);
          const bytes = new Uint8Array(await data.arrayBuffer());
          return gifResponse(bytes, aemetGifTime(bytes, Date.now()), "live");
        } catch (e) {
          const fallback = await archivedFrame(code);
          if (fallback) return fallback;
          return new Response(`AEMET no disponible: ${(e as Error).message}`, {
            status: 503,
            headers: { "Retry-After": "120", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
