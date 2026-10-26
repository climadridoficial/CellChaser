import { createFileRoute } from "@tanstack/react-router";

// Proxies AEMET OpenData "all conventional observations" (last ~12 h, hourly).
// AEMET returns a pointer ({ datos: url }) that must be fetched second, and the
// payload is ISO-8859-15 encoded. The caller supplies their own free AEMET key.
export const Route = createFileRoute("/api/public/aemet")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = request.headers.get("x-aemet-key")?.trim();
        if (!key) return Response.json({ error: "AEMET API key required" }, { status: 400 });

        const first = await fetch(
          "https://opendata.aemet.es/opendata/api/observacion/convencional/todas",
          { headers: { api_key: key, Accept: "application/json" } },
        );
        const meta = (await first.json().catch(() => null)) as
          | { estado?: number; descripcion?: string; datos?: string }
          | null;
        if (!first.ok || !meta?.datos || !meta.datos.startsWith("https://opendata.aemet.es/")) {
          return Response.json(
            { error: meta?.descripcion || `AEMET error (${first.status})` },
            { status: first.status === 200 ? 502 : first.status },
          );
        }
        const data = await fetch(meta.datos);
        if (!data.ok) return Response.json({ error: "AEMET data unavailable" }, { status: 502 });
        const text = new TextDecoder("iso-8859-15").decode(await data.arrayBuffer());
        return new Response(text, {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, max-age=300" },
        });
      },
    },
  },
});
