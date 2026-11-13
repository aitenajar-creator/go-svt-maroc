-- Prevent legacy default ACLs from re-granting broad anonymous access
-- when future tables or sequences are created in the public schema.
alter default privileges for role supabase_admin in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on tables from anon;

alter default privileges for role supabase_admin in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
