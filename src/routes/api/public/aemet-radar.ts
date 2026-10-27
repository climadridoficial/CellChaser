import { createFileRoute } from "@tanstack/react-router";
import { aemetFetch } from "@/lib/aemet-upstream";
import { AEMET_RADAR_CODES } from "@/lib/aemet-radars";

// Latest AEMET regional reflectivity image (GIF) for one radar.
export const Route = createFileRoute("/api/public/aemet-radar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = new URL(request.url).searchParams.get("r") ?? "";
        if (!AEMET_RADAR_CODES.has(code)) return new Response("Unknown radar", { status: 400 });
        try {
          const data = await aemetFetch(`red/radar/regional/${code}`);
          return new Response(data.body, {
            headers: { "Content-Type": "image/gif", "Cache-Control": "public, max-age=300" },
          });
        } catch (e) {
          return new Response((e as Error).message, { status: 502 });
        }
      },
    },
  },
});
