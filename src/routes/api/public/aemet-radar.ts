import { createFileRoute } from "@tanstack/react-router";
import { aemetFetch } from "@/lib/aemet-upstream";
import { AEMET_RADAR_CODES } from "@/lib/aemet-radars";
import { aemetGifTime } from "@/lib/aemet-timestamp";

// Latest AEMET regional reflectivity image (GIF) for one radar. The time
// printed on the image goes out as X-Observed-At so stale frames can be hidden.
export const Route = createFileRoute("/api/public/aemet-radar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = new URL(request.url).searchParams.get("r") ?? "";
        if (!AEMET_RADAR_CODES.has(code)) return new Response("Unknown radar", { status: 400 });
        try {
          const data = await aemetFetch(`red/radar/regional/${code}`);
          const bytes = new Uint8Array(await data.arrayBuffer());
          const headers: Record<string, string> = {
            "Content-Type": "image/gif",
            "Cache-Control": "public, max-age=300",
          };
          const observed = aemetGifTime(bytes);
          if (observed) headers["X-Observed-At"] = observed;
          return new Response(bytes, { headers });
        } catch (e) {
          return new Response((e as Error).message, { status: 502 });
        }
      },
    },
  },
});
