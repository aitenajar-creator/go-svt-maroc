-- Teacher-owned pins for questions in classes they manage.
-- Additive migration: does not modify questions or student records.

create table if not exists public.teacher_question_pins (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.teacher_questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, question_id)
);

create index if not exists teacher_question_pins_question_idx
  on public.teacher_question_pins(question_id);

alter table public.teacher_question_pins enable row level security;

drop policy if exists teacher_question_pins_select_owner on public.teacher_question_pins;
create policy teacher_question_pins_select_owner
on public.teacher_question_pins
for select to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1
    from public.teacher_questions q
    where q.id = question_id
      and public.gosvt_can_manage_class(q.class_id)
  )
);

drop policy if exists teacher_question_pins_insert_owner on public.teacher_question_pins;
create policy teacher_question_pins_insert_owner
on public.teacher_question_pins
for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and public.gosvt_is_teacher_or_admin()
  and exists (
    select 1
    from public.teacher_questions q
    where q.id = question_id
      and public.gosvt_can_manage_class(q.class_id)
  )
);

drop policy if exists teacher_question_pins_delete_owner on public.teacher_question_pins;
create policy teacher_question_pins_delete_owner
on public.teacher_question_pins
for delete to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1
    from public.teacher_questions q
    where q.id = question_id
      and public.gosvt_can_manage_class(q.class_id)
  )
);

grant select, insert, delete on public.teacher_question_pins to authenticated;
