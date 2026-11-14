-- TRUNCATE bypasses row-level security. REFERENCES and TRIGGER are not
-- required by the browser client on these tables either.
revoke truncate, references, trigger on table
  public.site_content_items,
  public.site_founder_profile,
  public.student_daily_challenges,
  public.student_study_plan
from authenticated;

-- Supabase projects can create public tables under either migration owner.
-- Prevent the same excessive privileges from silently returning on new tables.
alter default privileges for role supabase_admin in schema public
  revoke truncate, references, trigger on tables from authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;
