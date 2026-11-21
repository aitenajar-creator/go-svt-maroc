-- Persist each student's checked objectives for private lessons.
-- The existing owner-scoped RLS policy on student_learning_state protects this JSON.
alter table public.student_learning_state
  add column if not exists lesson_objectives jsonb not null default '{}'::jsonb;

alter table public.student_learning_state
  drop constraint if exists student_learning_state_lesson_objectives_object;

alter table public.student_learning_state
  add constraint student_learning_state_lesson_objectives_object
  check (jsonb_typeof(lesson_objectives) = 'object');

revoke all on table public.student_learning_state from anon;
grant select, insert, update on table public.student_learning_state to authenticated;
