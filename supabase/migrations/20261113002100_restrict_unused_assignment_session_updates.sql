-- Restrict classroom tables to operations currently used by the application.
-- The teacher UI creates and reads assignments/review sessions but has no edit
-- workflow. Keep the RLS UPDATE policies as an additional guard for a future
-- reviewed feature, while removing the authenticated UPDATE grant for now.
revoke update on table
  public.teacher_assignments,
  public.teacher_review_sessions
from authenticated;
