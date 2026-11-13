-- Prevent postgres-owned future tables and sequences from inheriting
-- broad anonymous privileges in the public schema.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
