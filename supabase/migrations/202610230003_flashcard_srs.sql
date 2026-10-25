-- Flashcards 5.0: retain actual spaced-review state with the learner's existing saved words.
alter table if exists public.practice_saved_words
  add column if not exists scheduler_version text,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists review_history jsonb not null default '[]'::jsonb;
