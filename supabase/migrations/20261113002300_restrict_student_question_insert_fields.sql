-- Student questions use database defaults for their initial status and timestamps.
-- The client only supplies class_id, student_id, subject and body; do not let a
-- student forge workflow state, identifiers or timestamps through direct API calls.
revoke insert (id, status, created_at, updated_at)
on table public.teacher_questions
from authenticated;
