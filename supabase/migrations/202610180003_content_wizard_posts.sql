-- Create Content Wizard 4.0 metadata. Safe to apply after the existing media-platform.sql.
alter table if exists public.posts add column if not exists content_status text not null default 'published';
alter table if exists public.posts add column if not exists visibility text not null default 'public';
alter table if exists public.posts add column if not exists cefr_levels text[] not null default '{}';
alter table if exists public.posts add column if not exists tags text[] not null default '{}';
alter table if exists public.posts add column if not exists course_id uuid references public.courses(id) on delete set null;
alter table if exists public.posts add column if not exists challenge_id uuid references public.challenges(id) on delete set null;
alter table if exists public.posts add column if not exists lesson_id uuid references public.course_lessons(id) on delete set null;

alter table if exists public.posts drop constraint if exists posts_content_status_check;
alter table if exists public.posts add constraint posts_content_status_check check (content_status in ('draft','processing','ready','published','failed'));
alter table if exists public.posts drop constraint if exists posts_visibility_check;
alter table if exists public.posts add constraint posts_visibility_check check (visibility in ('public','course_only','unlisted','private'));

create index if not exists posts_owner_status_created_idx on public.posts(user_id, content_status, created_at desc);
create index if not exists posts_course_idx on public.posts(course_id) where course_id is not null;
create index if not exists posts_challenge_idx on public.posts(challenge_id) where challenge_id is not null;
