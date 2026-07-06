-- ================================================================
-- Duvela Web — отмена брони слота учеником
-- Политика "Students can book slots" разрешает только бронировать
-- (is_booked false→true). Эта политика разрешает ученику ОТМЕНИТЬ
-- собственную бронь (освободить слот). Учитель по-прежнему управляет
-- своими слотами через "Teachers manage own slots".
-- Запустить один раз (idempotent).
-- ================================================================
drop policy if exists "Students can cancel own slot" on public.teacher_slots;
create policy "Students can cancel own slot" on public.teacher_slots
  for update
  using (booked_by_user_id = auth.uid())
  with check (is_booked = false and booked_by_user_id is null);
