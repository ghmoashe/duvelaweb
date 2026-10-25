-- Optional public broadcast metadata used by Studio 4.0.
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS category text;
