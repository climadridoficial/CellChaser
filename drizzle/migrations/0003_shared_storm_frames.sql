CREATE TABLE public.storm_cell_frames (
 radar_id text NOT NULL,
 source text NOT NULL CHECK (source IN ('opera','aemet')),
 observed_at timestamptz NOT NULL,
 cells jsonb NOT NULL DEFAULT '[]'::jsonb,
 PRIMARY KEY (radar_id, source, observed_at)
);
GRANT SELECT ON public.storm_cell_frames TO anon, authenticated;
GRANT ALL ON public.storm_cell_frames TO service_role;
ALTER TABLE public.storm_cell_frames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public numerical storm observations" ON public.storm_cell_frames FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.storm_track_frames (
 radar_id text NOT NULL,
 source text NOT NULL CHECK (source IN ('opera','aemet')),
 observed_at timestamptz NOT NULL,
 tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
 PRIMARY KEY (radar_id, source, observed_at)
);
GRANT SELECT ON public.storm_track_frames TO anon, authenticated;
GRANT ALL ON public.storm_track_frames TO service_role;
ALTER TABLE public.storm_track_frames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public shared storm predictions" ON public.storm_track_frames FOR SELECT TO anon, authenticated USING (true);