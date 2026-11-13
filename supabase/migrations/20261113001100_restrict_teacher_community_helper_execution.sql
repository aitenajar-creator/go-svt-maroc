-- These helpers are called by RLS policies and application checks for
-- signed-in members only. Keep authenticated EXECUTE; block public/anonymous RPC.
revoke all on function public.gosvt_teacher_community_is_admin() from public;
revoke all on function public.gosvt_teacher_community_is_admin() from anon;
grant execute on function public.gosvt_teacher_community_is_admin() to authenticated;

revoke all on function public.gosvt_teacher_community_is_approved_member() from public;
revoke all on function public.gosvt_teacher_community_is_approved_member() from anon;
grant execute on function public.gosvt_teacher_community_is_approved_member() to authenticated;
