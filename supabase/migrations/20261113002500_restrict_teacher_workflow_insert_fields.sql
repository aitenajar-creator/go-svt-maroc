-- Keep client inserts limited to fields used by the teacher classroom UI.
-- IDs and creation timestamps are database-generated and must not be client-forged.
revoke insert on table
  public.teacher_announcements,
  public.teacher_question_messages,
  public.teacher_question_pins,
  public.teacher_review_sessions
from authenticated;

grant insert (class_id, created_by, title, body)
on table public.teacher_announcements to authenticated;

grant insert (question_id, sender_id, body)
on table public.teacher_question_messages to authenticated;

grant insert (teacher_id, question_id)
on table public.teacher_question_pins to authenticated;

grant insert (class_id, created_by, title, description, starts_at, meeting_url)
on table public.teacher_review_sessions to authenticated;
