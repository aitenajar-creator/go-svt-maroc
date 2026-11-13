-- Apply least-privilege UPDATE grants to classroom questions and submissions.
-- Teachers may change a question's workflow status and grade a submission, but
-- cannot rewrite ownership, original question text, or the submitted answer.
revoke update on public.teacher_questions from authenticated;
revoke update (id, class_id, student_id, subject, body, created_at)
on public.teacher_questions
from authenticated;
grant update (status, updated_at)
on public.teacher_questions
to authenticated;

revoke update on public.teacher_assignment_submissions from authenticated;
revoke update (id, assignment_id, student_id, answer, submitted_at)
on public.teacher_assignment_submissions
from authenticated;
grant update (score, feedback, reviewed_at)
on public.teacher_assignment_submissions
to authenticated;
