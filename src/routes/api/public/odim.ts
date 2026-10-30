import { createFileRoute } from "@tanstack/react-router";

// The ODIM/HDF5 files live on the OpenRadarData S3 bucket, which does not send
// CORS headers, so the browser cannot fetch them directly. This route proxies
// them, restricted to the known OpenRadarData hosts.
const ALLOWED_HOSTS = new Set([
  "s3.waw3-1.cloudferro.com",
  "api.meteogate.eu",
  "radar.meteogate.eu",
]);

export const Route = createFileRoute("/api/public/odim")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url");
        if (!raw) return new Response("Missing url", { status: 400 });

        let target: URL;
        try {
          target = new URL(raw);
        } catch {
          return new Response("Invalid url", { status: 400 });
        }
        if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
          return new Response("Host not allowed", { status: 403 });
        }

        const auth = request.headers.get("authorization");
        const upstream = await fetch(target.toString(), auth ? { headers: { Authorization: auth } } : undefined);
        // 204 = upstream has no data for this query (e.g. a radar not transmitting); not an error.
        if (upstream.status === 204) return new Response(null, { status: 204 });
        if (!upstream.ok || !upstream.body) {
          return new Response("Upstream error", { status: upstream.status || 502 });
        }
        return new Response(upstream.body, {
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "application/x-odim",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
