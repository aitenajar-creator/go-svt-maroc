-- This function is invoked only by the BEFORE INSERT/UPDATE trigger.
-- Trigger execution does not require clients to hold direct EXECUTE privileges.
revoke all on function public.prevent_duplicate_site_content_upload() from public;
revoke all on function public.prevent_duplicate_site_content_upload() from anon;
revoke all on function public.prevent_duplicate_site_content_upload() from authenticated;
