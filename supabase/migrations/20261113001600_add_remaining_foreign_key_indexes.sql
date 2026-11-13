-- Complete FK index coverage for the student-answer and teacher feedback tables.
create index if not exists idx_student_answers_question_fk
  on public.student_answers (question_id);
create index if not exists idx_teacher_assignment_submissions_student_fk
  on public.teacher_assignment_submissions (student_id);
create index if not exists idx_teacher_student_notes_student_fk
  on public.teacher_student_notes (student_id);
create index if not exists idx_teacher_student_support_plans_student_fk
  on public.teacher_student_support_plans (student_id);
