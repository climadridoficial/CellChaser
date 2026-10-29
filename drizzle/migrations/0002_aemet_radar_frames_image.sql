ALTER TABLE public.aemet_radar_frames ADD COLUMN image_b64 text;
COMMENT ON COLUMN public.aemet_radar_frames.image_b64 IS 'Base64 GIF as published by AEMET OpenData';