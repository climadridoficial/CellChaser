CREATE TABLE public.aemet_radar_frames (
  code text NOT NULL,
  observed_at timestamptz NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, observed_at)
);

GRANT SELECT ON public.aemet_radar_frames TO anon, authenticated;
GRANT ALL ON public.aemet_radar_frames TO service_role;

ALTER TABLE public.aemet_radar_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Archived AEMET radar frames are public"
ON public.aemet_radar_frames
FOR SELECT
TO anon, authenticated
USING (true);

CREATE INDEX aemet_radar_frames_observed_at_idx ON public.aemet_radar_frames (observed_at);