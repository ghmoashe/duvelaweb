-- SECURITY DEFINER functions are executable by PUBLIC unless explicitly
-- revoked. Only signed-in users may confirm an unresolved legacy role.

revoke all on function public.confirm_legacy_web_role(text) from public;
revoke all on function public.confirm_legacy_web_role(text) from anon;
grant execute on function public.confirm_legacy_web_role(text) to authenticated;
