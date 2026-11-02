import { createFileRoute } from "@tanstack/react-router";

import { operaTarget } from '@/lib/opera-cache-policy';

export const Route = createFileRoute("/api/public/odim")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url");
        if (!raw) return new Response("Missing url", { status: 400 });

        try {
          operaTarget(raw);
        } catch {
          return new Response("Invalid radar url", { status: 400 });
        }
        const { sharedOperaResponse } = await import('@/lib/opera-cache.server');
        return sharedOperaResponse(raw, request.headers.get('authorization'), new URL(request.url).origin);
      },
    },
  },
});
