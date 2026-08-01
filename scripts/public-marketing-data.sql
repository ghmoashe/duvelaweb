-- Public homepage reads. Apply in Supabase SQL editor after review, then set
-- publicMarketingDataEnabled to true in web/duvela-web-config.js.
-- Only rows intended for marketing are exposed to anonymous visitors.

alter table public.live_sessions enable row level security;

drop policy if exists "public read discoverable live sessions" on public.live_sessions;
create policy "public read discoverable live sessions"
  on public.live_sessions
  for select
  to anon
  using (
    is_private = false
    and status in ('live', 'scheduled')
  );

alter table public.courses enable row level security;

drop policy if exists "public read active courses" on public.courses;
create policy "public read active courses"
  on public.courses
  for select
  to anon, authenticated
  using (status = 'active');
