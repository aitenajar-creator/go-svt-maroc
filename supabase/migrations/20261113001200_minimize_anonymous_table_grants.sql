-- Anonymous visitors need read-only access to the two deliberately public
-- profile/content tables. RLS remains the row-level authorization boundary.
-- Remove broad legacy table grants from anon on every current public table.
revoke all privileges on all tables in schema public from anon;

grant select on table public.site_content_items to anon;
grant select on table public.site_founder_profile to anon;
