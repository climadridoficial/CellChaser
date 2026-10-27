import { createFileRoute } from "@tanstack/react-router";
import { aemetFetch } from "@/lib/aemet-upstream";

// Latest conventional observations from every AEMET station (ISO-8859-15 → UTF-8).
export const Route = createFileRoute("/api/public/aemet")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const data = await aemetFetch(
            "observacion/convencional/todas",
            request.headers.get("x-aemet-key")?.trim() || null,
          );
          const text = new TextDecoder("iso-8859-15").decode(await data.arrayBuffer());
          return new Response(text, {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=600",
            },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 502 });
        }
      },
    },
  },
});
