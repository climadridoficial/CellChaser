// Archived AEMET OpenData regional images (filled by the scheduled
// /api/public/jobs/aemet-archive job), read straight from the database.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HISTORY_HOURS, pickFrame } from "./timeline";

export interface AemetFrame {
  code: string;
  observedAt: string;
  time: number;
}

async function fetchAemetFrames(): Promise<AemetFrame[]> {
  const since = new Date(Date.now() - (HISTORY_HOURS + 1) * 3600_000).toISOString();
  const { data, error } = await supabase
    .from("aemet_radar_frames")
    .select("code, observed_at")
    .gte("observed_at", since)
    .order("observed_at")
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ code: r.code, observedAt: r.observed_at, time: Date.parse(r.observed_at) }));
}

export function useAemetFrames(enabled: boolean) {
  return useQuery({
    queryKey: ["aemet-frames"],
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: fetchAemetFrames,
  });
}

export function aemetFrameFor(frames: AemetFrame[] | undefined, code: string, at: number): AemetFrame | null {
  if (!frames) return null;
  return pickFrame(frames.filter((f) => f.code === code), (f) => f.time, at);
}

/** The archived GIF as a data URL. */
export async function fetchAemetFrameUrl(frame: AemetFrame): Promise<string> {
  const { data, error } = await supabase
    .from("aemet_radar_frames")
    .select("image_b64")
    .eq("code", frame.code)
    .eq("observed_at", frame.observedAt)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.image_b64) throw new Error("Imagen archivada no disponible.");
  return `data:image/gif;base64,${data.image_b64}`;
}
