-- Private teacher-only pedagogical notes for individual students.
create table if not exists public.teacher_student_notes (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.teacher_classes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,
 teacher_id uuid not null references public.profiles(id) on delete cascade,
 note text not null check (char_length(trim(note)) between 1 and 5000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint teacher_student_notes_enrollment_fk foreign key (class_id,student_id)
 references public.teacher_class_students(class_id,student_id) on delete cascade
);
create index if not exists teacher_student_notes_class_student_date_idx
 on public.teacher_student_notes(class_id,student_id,created_at desc);
create or replace function public.gosvt_touch_teacher_student_note()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at:=now(); return new; end; $$;
drop trigger if exists teacher_student_notes_touch_updated_at on public.teacher_student_notes;
create trigger teacher_student_notes_touch_updated_at before update on public.teacher_student_notes
for each row execute function public.gosvt_touch_teacher_student_note();
alter table public.teacher_student_notes enable row level security;
drop policy if exists teacher_student_notes_select_teacher on public.teacher_student_notes;
create policy teacher_student_notes_select_teacher on public.teacher_student_notes
for select to authenticated using (public.gosvt_can_manage_class(class_id));
drop policy if exists teacher_student_notes_insert_teacher on public.teacher_student_notes;
create policy teacher_student_notes_insert_teacher on public.teacher_student_notes
for insert to authenticated with check (
 teacher_id=(select auth.uid()) and public.gosvt_can_manage_class(class_id)
 and exists(select 1 from public.teacher_class_students cs
 where cs.class_id=teacher_student_notes.class_id and cs.student_id=teacher_student_notes.student_id)
);
drop policy if exists teacher_student_notes_update_author on public.teacher_student_notes;
create policy teacher_student_notes_update_author on public.teacher_student_notes
for update to authenticated using (
 public.gosvt_can_manage_class(class_id) and (teacher_id=(select auth.uid()) or public.gosvt_is_admin())
) with check (
 public.gosvt_can_manage_class(class_id) and (teacher_id=(select auth.uid()) or public.gosvt_is_admin())
 and exists(select 1 from public.teacher_class_students cs
 where cs.class_id=teacher_student_notes.class_id and cs.student_id=teacher_student_notes.student_id)
);
drop policy if exists teacher_student_notes_delete_author on public.teacher_student_notes;
create policy teacher_student_notes_delete_author on public.teacher_student_notes
for delete to authenticated using (
 public.gosvt_can_manage_class(class_id) and (teacher_id=(select auth.uid()) or public.gosvt_is_admin())
);
grant select,insert,update,delete on public.teacher_student_notes to authenticated;
