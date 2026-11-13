-- Restrict class authorization helpers to authenticated callers.
-- These SECURITY DEFINER helpers expose only authorization booleans, but should
-- not be callable by anonymous/public roles. RLS policies and classroom RPCs
-- continue to work for authenticated users.
revoke all on function public.gosvt_is_teacher_or_admin() from public, anon;
revoke all on function public.gosvt_is_admin() from public, anon;
revoke all on function public.gosvt_can_manage_class(uuid) from public, anon;
revoke all on function public.gosvt_can_access_class(uuid) from public, anon;

grant execute on function public.gosvt_is_teacher_or_admin() to authenticated;
grant execute on function public.gosvt_is_admin() to authenticated;
grant execute on function public.gosvt_can_manage_class(uuid) to authenticated;
grant execute on function public.gosvt_can_access_class(uuid) to authenticated;
