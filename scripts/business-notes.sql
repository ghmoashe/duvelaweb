-- Duvela Web / Business: creator notes synced across devices.
-- Run in Supabase SQL Editor after the core Duvela web schema.

create extension if not exists pgcrypto;

create table if not exists public.business_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  note_type text not null default 'lesson',
  status text not null default 'draft',
  is_pinned boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_notes_type_check check (note_type in ('lesson','content','event','student','business')),
  constraint business_notes_status_check check (status in ('draft','todo','done'))
);

create index if not exists business_notes_user_updated_idx
  on public.business_notes (user_id, is_pinned desc, updated_at desc);

create index if not exists business_notes_user_due_idx
  on public.business_notes (user_id, due_date)
  where due_date is not null;

alter table public.business_notes enable row level security;

drop policy if exists "business_notes_select_own" on public.business_notes;
create policy "business_notes_select_own"
  on public.business_notes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "business_notes_insert_own" on public.business_notes;
create policy "business_notes_insert_own"
  on public.business_notes for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "business_notes_update_own" on public.business_notes;
create policy "business_notes_update_own"
  on public.business_notes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "business_notes_delete_own" on public.business_notes;
create policy "business_notes_delete_own"
  on public.business_notes for delete to authenticated
  using (user_id = auth.uid());

