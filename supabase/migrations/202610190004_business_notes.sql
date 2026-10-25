create table if not exists public.business_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '',
  note_type text not null default 'lesson',
  status text not null default 'draft',
  is_pinned boolean not null default false,
  due_date date,
  linked_type text,
  linked_id text,
  linked_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_notes add column if not exists linked_type text;
alter table public.business_notes add column if not exists linked_id text;
alter table public.business_notes add column if not exists linked_label text;

create index if not exists business_notes_user_updated_idx on public.business_notes(user_id, updated_at desc);
alter table public.business_notes enable row level security;
drop policy if exists business_notes_owner_select on public.business_notes;
drop policy if exists business_notes_owner_insert on public.business_notes;
drop policy if exists business_notes_owner_update on public.business_notes;
drop policy if exists business_notes_owner_delete on public.business_notes;
create policy business_notes_owner_select on public.business_notes for select using (auth.uid() = user_id);
create policy business_notes_owner_insert on public.business_notes for insert with check (auth.uid() = user_id);
create policy business_notes_owner_update on public.business_notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy business_notes_owner_delete on public.business_notes for delete using (auth.uid() = user_id);
