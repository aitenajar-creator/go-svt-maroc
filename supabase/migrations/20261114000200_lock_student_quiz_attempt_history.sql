-- Quiz attempt history is append-only: the client sync uses upsert(...,
-- ignoreDuplicates: true), so existing attempts are never updated.
-- Keep students from rewriting or deleting records used in teacher progress trends.
drop policy if exists student_quiz_attempts_update_own
  on public.student_quiz_attempts;
drop policy if exists student_quiz_attempts_delete_own
  on public.student_quiz_attempts;

-- Remove all table-level capabilities first, including unused TRUNCATE,
-- REFERENCES and TRIGGER privileges, then restore only required operations.
revoke all privileges on table public.student_quiz_attempts
from authenticated;

grant select on table public.student_quiz_attempts to authenticated;

-- Restrict inserts to the payload produced by GoSVTCloud.syncQuizAttempts.
-- The primary key and created_at remain database-generated.
grant insert (
  student_id,
  attempt_id,
  quiz_id,
  score,
  total_questions,
  percentage,
  mistakes,
  attempted_at
)
on table public.student_quiz_attempts to authenticated;
