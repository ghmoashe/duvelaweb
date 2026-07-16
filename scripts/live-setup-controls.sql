alter table public.live_sessions
  add column if not exists allow_guest_requests boolean not null default true,
  add column if not exists min_viewer_age integer not null default 0,
  add column if not exists video_quality text not null default 'auto';

alter table public.live_sessions drop constraint if exists live_sessions_min_viewer_age_check;
alter table public.live_sessions
  add constraint live_sessions_min_viewer_age_check check (min_viewer_age in (0, 18));

alter table public.live_sessions drop constraint if exists live_sessions_video_quality_check;
alter table public.live_sessions
  add constraint live_sessions_video_quality_check check (video_quality in ('auto', '540p', '720p'));
