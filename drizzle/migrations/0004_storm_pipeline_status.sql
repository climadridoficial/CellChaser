ALTER TABLE public.storm_cell_frames ADD COLUMN algorithm_version integer NOT NULL DEFAULT 2;
ALTER TABLE public.storm_track_frames ADD COLUMN algorithm_version integer NOT NULL DEFAULT 2;
CREATE TABLE public.storm_source_state (
 radar_id text NOT NULL,
 source text NOT NULL CHECK (source IN ('opera','aemet')),
 available boolean NOT NULL DEFAULT false,
 checked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (radar_id, source)
);
GRANT SELECT ON public.storm_source_state TO anon, authenticated;
GRANT ALL ON public.storm_source_state TO service_role;
ALTER TABLE public.storm_source_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public storm source availability" ON public.storm_source_state FOR SELECT TO anon, authenticated USING (true);