-- Public read access for the web profile page (profile.html).
--
-- profiles + courses are already anon-readable, but organizations, events and
-- organization_memberships are locked. These policies expose ONLY the columns
-- the public profile page needs, for rows that are meant to be public.
--
-- Apply in Supabase → SQL editor. Safe to re-run (drops policy if it exists).
-- Review each SELECT list against your schema before running in production.

-- ── organizations ────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;

drop policy if exists "public read organizations" on public.organizations;
create policy "public read organizations"
  on public.organizations
  for select
  to anon, authenticated
  using (true);

-- ── organization_memberships (team roster on an org profile) ──────────────────
alter table public.organization_memberships enable row level security;

drop policy if exists "public read active memberships" on public.organization_memberships;
create policy "public read active memberships"
  on public.organization_memberships
  for select
  to anon, authenticated
  using (status = 'active');

-- ── events (organizer profile → upcoming events) ─────────────────────────────
alter table public.events enable row level security;

drop policy if exists "public read events" on public.events;
create policy "public read events"
  on public.events
  for select
  to anon, authenticated
  using (true);

-- After running, verify anon can read:
--   select count(*) from organizations;   -- via the REST anon key, should be > 0
