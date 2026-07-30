-- Duvela Web / Business: withdrawal requests for teacher/organizer business income.
-- Run in Supabase SQL Editor after the core Duvela web schema.

create extension if not exists pgcrypto;

create table if not exists public.business_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  currency text not null default 'DC',
  method text not null,
  payout_details text,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_withdrawal_amount_check check (amount >= 100),
  constraint business_withdrawal_currency_check check (currency in ('DC')),
  constraint business_withdrawal_method_check check (method in ('bank','paypal','wise','other')),
  constraint business_withdrawal_status_check check (status in ('pending','approved','paid','rejected','cancelled'))
);

create index if not exists business_withdrawal_requests_user_created_idx
  on public.business_withdrawal_requests (user_id, created_at desc);

create index if not exists business_withdrawal_requests_status_created_idx
  on public.business_withdrawal_requests (status, created_at desc);

alter table public.business_withdrawal_requests enable row level security;

drop policy if exists "business_withdrawal_select_own" on public.business_withdrawal_requests;
create policy "business_withdrawal_select_own"
  on public.business_withdrawal_requests
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "business_withdrawal_insert_own_pending" on public.business_withdrawal_requests;
create policy "business_withdrawal_insert_own_pending"
  on public.business_withdrawal_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "business_withdrawal_update_own_pending_cancel" on public.business_withdrawal_requests;
create policy "business_withdrawal_update_own_pending_cancel"
  on public.business_withdrawal_requests
  for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status in ('pending','cancelled'));

