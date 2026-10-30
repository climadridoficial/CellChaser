import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// OPERA storm detection, split into parts so each scheduled request stays within outbound-call limits.
export const PARTS = 3;
export const Route = createFileRoute("/api/public/jobs/opera-storms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = await request.json().catch(() => ({})) as { part?: number };
        const part = Number.isInteger(body.part) && body.part! >= 0 && body.part! < PARTS ? body.part! : 0;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { refreshOperaStorms } = await import("@/lib/storm-pipeline.server");
        return Response.json({ part, opera: await refreshOperaStorms(supabaseAdmin, part, PARTS) });
      },
    },
  },
});
