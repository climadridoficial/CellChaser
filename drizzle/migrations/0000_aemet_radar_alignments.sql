CREATE TABLE public.radar_alignments (
  user_id uuid NOT NULL,
  radar_code text NOT NULL CHECK (radar_code IN ('ml','ca','se','ba','vd','am','za','cc','ss','ma','co','mu','pm','sa','va')),
  south double precision NOT NULL CHECK (south BETWEEN -85 AND 85),
  west double precision NOT NULL CHECK (west BETWEEN -180 AND 180),
  north double precision NOT NULL CHECK (north BETWEEN -85 AND 85),
  east double precision NOT NULL CHECK (east BETWEEN -180 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, radar_code),
  CHECK (south < north AND west < east)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_alignments TO authenticated;
GRANT ALL ON public.radar_alignments TO service_role;
ALTER TABLE public.radar_alignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own radar alignments" ON public.radar_alignments FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Insert own radar alignments" ON public.radar_alignments FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Update own radar alignments" ON public.radar_alignments FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Delete own radar alignments" ON public.radar_alignments FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);