-- Mistake Center 6.1: retain the source-backed review context for each learner.
-- The existing user-scoped RLS policies continue to apply unchanged.
alter table public.practice_mistakes
  add column if not exists level text,
  add column if not exists details jsonb not null default '{}'::jsonb;

comment on column public.practice_mistakes.details is
  'Question source metadata, recorded learner answer, explanation and bounded review history.';
