-- Column-level revokes do not override an existing table-level INSERT grant.
-- Remove that broad grant, then allow only the four fields the student UI sends.
revoke insert on table public.teacher_questions from authenticated;
grant insert (class_id, student_id, subject, body)
on table public.teacher_questions to authenticated;
