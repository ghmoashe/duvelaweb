alter table public.live_restream_targets
  add column if not exists converter_id text,
  add column if not exists converter_region text;
