-- GO SVT Maroc: classify private teacher follow-up notes.
alter table public.teacher_student_notes
  add column if not exists note_type text not null default 'other';

alter table public.teacher_student_notes
  drop constraint if exists teacher_student_notes_note_type_check;

alter table public.teacher_student_notes
  add constraint teacher_student_notes_note_type_check
  check (note_type in ('understanding', 'results', 'attendance', 'progress', 'other'));

create index if not exists teacher_student_notes_class_student_type_idx
  on public.teacher_student_notes (class_id, student_id, note_type, created_at desc);
