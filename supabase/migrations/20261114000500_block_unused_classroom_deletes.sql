-- No delete workflow exists in the current teacher classroom UI for these records.
-- Deleting a class cascades into enrollments, questions, assignments, submissions,
-- announcements, review sessions, notes and support plans. Keep these records intact
-- until an explicit archive/retention workflow is implemented.
drop policy if exists teacher_classes_delete_owner on public.teacher_classes;
revoke delete on public.teacher_classes from authenticated;

-- Assignment deletion cascades into student submissions and their teacher feedback.
drop policy if exists teacher_assignments_delete_manage_class on public.teacher_assignments;
revoke delete on public.teacher_assignments from authenticated;

-- These resources also have no delete controls in the current UI.
drop policy if exists teacher_announcements_delete_teacher on public.teacher_announcements;
revoke delete on public.teacher_announcements from authenticated;

drop policy if exists teacher_review_sessions_delete_manage_teacher on public.teacher_review_sessions;
revoke delete on public.teacher_review_sessions from authenticated;
