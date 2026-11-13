-- Remove broad legacy/default table grants from classroom-facing teacher tables.
-- RLS remains the row-level boundary; these revocations remove operations that
-- are not part of the teacher/student workflows and preserve intended column grants.

revoke truncate, references, trigger
on table
  public.teacher_classes,
  public.teacher_class_students,
  public.teacher_questions,
  public.teacher_question_messages,
  public.teacher_question_pins,
  public.teacher_assignments,
  public.teacher_assignment_submissions,
  public.teacher_announcements,
  public.teacher_review_sessions,
  public.teacher_student_notes,
  public.teacher_student_support_plans
from authenticated;

-- Membership is created only through the validated SECURITY DEFINER join RPC.
revoke insert, update on public.teacher_class_students from authenticated;

-- Questions and messages are student-authored; teachers may update only the
-- explicitly granted question workflow columns (status, updated_at).
revoke delete on public.teacher_questions from authenticated;
revoke update, delete on public.teacher_question_messages from authenticated;

-- Pins are private teacher-owned references and do not need direct UPDATE.
revoke update on public.teacher_question_pins from authenticated;

-- Announcements are created/deleted by class managers, not edited in place.
revoke update on public.teacher_announcements from authenticated;

-- Submissions are retained as student work; teachers grade only the explicitly
-- granted score, feedback and reviewed_at columns.
revoke delete on public.teacher_assignment_submissions from authenticated;
