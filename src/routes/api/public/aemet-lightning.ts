import { createFileRoute } from "@tanstack/react-router";
import { aemetFetch } from "@/lib/aemet-upstream";

// Latest AEMET lightning-strike map (national image). OpenData only serves the
// most recent map, so this is a live-only layer with a short cache.

export const Route = createFileRoute("/api/public/aemet-lightning")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const data = await aemetFetch("red/rayos/mapa");
          const bytes = new Uint8Array(await data.arrayBuffer());
          const type = data.headers.get("Content-Type") ?? "image/png";
          return new Response(bytes, {
            headers: {
              "Content-Type": type,
              "Cache-Control": "public, max-age=600",
            },
          });
        } catch (e) {
          // Expected outage, not a server fault: 204 tells the app "no current image".
          return new Response(null, {
            status: 204,
            headers: {
              "Retry-After": "300",
              "Cache-Control": "no-store",
              "X-Unavailable": encodeURIComponent(`AEMET no disponible: ${(e as Error).message}`),
            },
          });
        }
      },
    },
  },
});
