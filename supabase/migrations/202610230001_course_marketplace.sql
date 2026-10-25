-- Learner course marketplace: explicit test visibility and server-backed saves.
alter table if exists public.courses
  add column if not exists is_test boolean not null default false;

create index if not exists courses_public_marketplace_idx
  on public.courses (status, is_test, created_at desc);

-- These exact records were verified in production on 2026-10-23 as automated QA fixtures.
-- Identification is by immutable id, never by a title pattern.
update public.courses
set is_test = true
where id in (
  'ff941975-3029-43f4-8bb4-746494f1a4d8'::uuid,
  'b9b04e70-684f-4274-aa26-bc56f4c70bbf'::uuid
);

-- Ordinary discovery is enforced at the database boundary. Existing owner/admin
-- policies remain available, so creators and administrators can still inspect QA data.
drop policy if exists "public read active courses" on public.courses;
create policy "public read active courses" on public.courses
  for select to anon, authenticated
  using (status = 'active' and is_test = false);

create table if not exists public.course_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

alter table public.course_saves enable row level security;

drop policy if exists "course_saves_select_own" on public.course_saves;
create policy "course_saves_select_own" on public.course_saves
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "course_saves_insert_own" on public.course_saves;
create policy "course_saves_insert_own" on public.course_saves
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.courses course
      where course.id = course_id
        and course.status = 'active'
        and course.is_test = false
    )
  );

drop policy if exists "course_saves_delete_own" on public.course_saves;
create policy "course_saves_delete_own" on public.course_saves
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.course_saves to authenticated;
