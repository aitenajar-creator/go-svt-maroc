-- This function is invoked only by the profiles BEFORE UPDATE trigger.
-- PostgreSQL does not require clients to hold direct EXECUTE for trigger invocation.
revoke all on function public.prevent_profile_role_change() from public;
revoke all on function public.prevent_profile_role_change() from anon;
revoke all on function public.prevent_profile_role_change() from authenticated;
