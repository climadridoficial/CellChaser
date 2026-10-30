import { createFileRoute } from "@tanstack/react-router";
import { aemetFetch } from "@/lib/aemet-upstream";
import { AEMET_RADAR_CODES } from "@/lib/aemet-radars";
import { aemetGifTime } from "@/lib/aemet-timestamp";
import { radarFrameVisible } from "@/lib/radar-freshness";
import { AEMET_LIVE_MAX_AGE_MS } from "@/lib/composite";

// Latest AEMET regional reflectivity image (GIF) for one radar. The time
// printed on the image goes out as X-Observed-At so stale frames can be hidden.
// Archived frames are historical-only: never substitute them during an outage.

function gifResponse(bytes: Uint8Array<ArrayBuffer>, observed: string | null, source: "live" | "archive") {
  const headers: Record<string, string> = {
    "Content-Type": "image/gif",
    "Cache-Control": source === "live" ? "public, max-age=300" : "no-store",
    "X-Source": source,
  };
  if (observed) headers["X-Observed-At"] = observed;
  return new Response(bytes, { headers });
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
          const observed = aemetGifTime(bytes, Date.now());
          if (!radarFrameVisible(observed, null, AEMET_LIVE_MAX_AGE_MS, Date.now())) {
            // Expected outage, not a server fault: 204 tells the app "no current image".
            return new Response(null, { status: 204, headers: { "Retry-After": "120", "Cache-Control": "no-store", "X-Unavailable": encodeURIComponent("AEMET no publica una imagen actual de este radar.") } });
          }
          return gifResponse(bytes, observed, "live");
        } catch (e) {
          // Expected outage, not a server fault: 204 tells the app "no current image".
            return new Response(null, { status: 204, headers: { "Retry-After": "120", "Cache-Control": "no-store", "X-Unavailable": encodeURIComponent(`AEMET no disponible: ${(e as Error).message}`) } });
        }
      },
    },
  },
});
