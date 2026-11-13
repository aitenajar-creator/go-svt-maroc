-- Students may submit their answer, but grading fields belong exclusively to teachers.
-- Existing submissions and grades are preserved; this only narrows future client INSERT privileges.
revoke insert on public.teacher_assignment_submissions from authenticated;

grant insert (assignment_id, student_id, answer)
on public.teacher_assignment_submissions
to authenticated;
