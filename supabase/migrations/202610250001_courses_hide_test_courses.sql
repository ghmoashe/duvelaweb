-- Follow-up to 202610230001_course_marketplace.sql. That migration narrowed the
-- "public read active courses" policy to is_test = false, but a second permissive
-- policy, courses_select_public_active (status = 'active', all roles), still let
-- everyone read the QA fixture courses. Permissive policies are OR-ed, so it must be
-- narrowed the same way. Organization members keep their own policy
-- (courses_select_member).
alter policy courses_select_public_active on public.courses
  using (status = 'active' and is_test = false);
