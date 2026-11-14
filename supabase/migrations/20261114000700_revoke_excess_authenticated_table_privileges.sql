-- TRUNCATE bypasses row-level security. REFERENCES and TRIGGER are not
-- required by the browser client either.
revoke truncate, references, trigger on table
  public.site_content_items,
  public.site_founder_profile,
  public.student_daily_challenges,
  public.student_study_plan
from authenticated;
