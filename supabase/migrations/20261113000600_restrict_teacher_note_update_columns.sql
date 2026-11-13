-- Keep private-note ownership and placement immutable after creation.
-- Authors may edit only the note text and its pedagogical category.
-- updated_at remains maintained by the existing BEFORE UPDATE trigger.
revoke update on public.teacher_student_notes from authenticated;
revoke update (
  id, class_id, student_id, teacher_id, created_at, updated_at
) on public.teacher_student_notes from authenticated;
grant update (note, note_type)
on public.teacher_student_notes
to authenticated;
