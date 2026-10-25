-- Adaptive Path 6.0: one learner-owned daily route shared by Web and Academy Hub.
create table if not exists public.adaptive_learning_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  language text not null,
  current_level text not null,
  target_level text not null,
  plan_version integer not null default 1 check (plan_version > 0),
  signal text not null default '',
  route jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adaptive_learning_plans_daily_unique unique (user_id, plan_date, language)
);

create index if not exists adaptive_learning_plans_user_date_idx
  on public.adaptive_learning_plans (user_id, plan_date desc);

alter table public.adaptive_learning_plans enable row level security;

drop policy if exists "adaptive_learning_plans_select_own" on public.adaptive_learning_plans;
create policy "adaptive_learning_plans_select_own"
  on public.adaptive_learning_plans for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "adaptive_learning_plans_insert_own" on public.adaptive_learning_plans;
create policy "adaptive_learning_plans_insert_own"
  on public.adaptive_learning_plans for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "adaptive_learning_plans_update_own" on public.adaptive_learning_plans;
create policy "adaptive_learning_plans_update_own"
  on public.adaptive_learning_plans for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.adaptive_learning_plans to authenticated;
