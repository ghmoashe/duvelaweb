-- ================================================================
-- Duvela Web — запрос бизнес-роли из браузера («role request»)
-- Веб-кабинет (app.html) даёт войти как ученик, а для роли
-- teacher / organizer / organization отправляет ЗАПРОС. Реальный
-- доступ по-прежнему открывают только флаги profiles.is_teacher /
-- is_organizer / is_admin — эти поля лишь фиксируют состояние заявки
-- для UI и для ревью админом.
--
-- Запустить один раз в Supabase SQL Editor (idempotent).
-- ================================================================

-- ── 1. Колонки заявки на роль в profiles ─────────────────────────────────────
alter table public.profiles
  add column if not exists requested_role      text,        -- какую роль просят
  add column if not exists role_request_status text,        -- pending | approved | denied | rejected
  add column if not exists requested_role_at   timestamptz, -- когда отправили заявку
  add column if not exists last_web_role        text;       -- последняя выбранная в вебе роль

-- ── 2. Ограничения на допустимые значения (null = заявки нет) ─────────────────
alter table public.profiles
  drop constraint if exists profiles_role_request_status_check;
alter table public.profiles
  add  constraint profiles_role_request_status_check
  check (role_request_status is null
         or role_request_status in ('pending', 'approved', 'denied', 'rejected'));

alter table public.profiles
  drop constraint if exists profiles_requested_role_check;
alter table public.profiles
  add  constraint profiles_requested_role_check
  check (requested_role is null
         or requested_role in ('learner', 'teacher', 'organizer', 'organization', 'admin'));

-- ── 3. Индекс для админа: быстро найти ожидающие заявки ──────────────────────
create index if not exists profiles_role_request_pending_idx
  on public.profiles (role_request_status)
  where role_request_status = 'pending';

-- RLS не трогаем: политика "Users can update own profile" (auth.uid() = id)
-- уже позволяет пользователю записать свою заявку. Одобрение (выставление
-- is_teacher / is_organizer) делает админ или бэкенд — вручную или отдельным
-- процессом.


-- ================================================================
-- ОПЦИОНАЛЬНО (рекомендуется): запретить самоназначение админа
-- ----------------------------------------------------------------
-- Политика обновления профиля не ограничивает колонки, поэтому сейчас
-- пользователь технически может выставить себе is_admin = true. Этот
-- триггер «замораживает» привилегированные флаги для НЕ-админов, но
-- НЕ трогает is_teacher / is_organizer (они самодекларируются при
-- регистрации) и НЕ трогает score / vela_coin_balance (их синхронизирует
-- клиент как XP). Бэкенд с service_role (auth.uid() = null) не ограничен.
-- ================================================================
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- доверяем бэкенду (service_role: auth.uid() = null) и настоящим админам
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
  end if;
  -- обычный пользователь не может повышать себе привилегии
  new.is_admin    := old.is_admin;
  new.is_verified := old.is_verified;
  return new;
end;
$$;

drop trigger if exists trg_protect_privileged_profile_columns on public.profiles;
create trigger trg_protect_privileged_profile_columns
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();
