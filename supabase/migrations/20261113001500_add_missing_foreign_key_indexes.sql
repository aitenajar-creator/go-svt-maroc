-- Cover foreign-key columns that otherwise require scans when referenced rows
-- are updated/deleted. These indexes are safe to build on the currently small
-- classroom, assignment, audit, and resource tables and support future growth.
create index if not exists idx_class_students_enrolled_by_fk
  on public.class_students (enrolled_by);
create index if not exists idx_class_teachers_assigned_by_fk
  on public.class_teachers (assigned_by);
create index if not exists idx_classes_created_by_fk
  on public.classes (created_by);
create index if not exists idx_exercises_created_by_fk
  on public.exercises (created_by);
create index if not exists idx_role_change_requests_requested_by_fk
  on public.role_change_requests (requested_by);
create index if not exists idx_role_change_requests_reviewed_by_fk
  on public.role_change_requests (reviewed_by);
create index if not exists idx_role_change_requests_target_user_fk
  on public.role_change_requests (target_user_id);
create index if not exists idx_security_audit_log_actor_fk
  on public.security_audit_log (actor_id);
create index if not exists idx_site_content_items_created_by_fk
  on public.site_content_items (created_by);
create index if not exists idx_site_founder_profile_updated_by_fk
  on public.site_founder_profile (updated_by);
create index if not exists idx_student_submissions_graded_by_fk
  on public.student_submissions (graded_by);
create index if not exists idx_teacher_announcements_class_fk
  on public.teacher_announcements (class_id);
create index if not exists idx_teacher_announcements_created_by_fk
  on public.teacher_announcements (created_by);
create index if not exists idx_teacher_assignments_created_by_fk
  on public.teacher_assignments (created_by);
create index if not exists idx_teacher_question_messages_sender_fk
  on public.teacher_question_messages (sender_id);
create index if not exists idx_teacher_review_sessions_class_fk
  on public.teacher_review_sessions (class_id);
create index if not exists idx_teacher_review_sessions_created_by_fk
  on public.teacher_review_sessions (created_by);
create index if not exists idx_teacher_student_notes_teacher_fk
  on public.teacher_student_notes (teacher_id);
create index if not exists idx_teacher_student_support_plans_teacher_fk
  on public.teacher_student_support_plans (teacher_id);
