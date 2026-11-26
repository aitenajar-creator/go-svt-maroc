-- MAIN project only. One row per student/lesson avoids replacing unrelated lesson progress.
-- The previous JSON column remains intact for rollback and older clients.
create table if not exists public.student_lesson_objectives (
  student_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.private_student_lessons(id) on delete cascade,
  checked_indices integer[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (student_id, lesson_id),
  constraint student_lesson_objectives_valid_indices check (
    cardinality(checked_indices) <= 200 and array_position(checked_indices, null) is null
    and 0 <= all(checked_indices) and 199 >= all(checked_indices)
  )
);
create index student_lesson_objectives_lesson_idx on public.student_lesson_objectives(lesson_id);
alter table public.student_lesson_objectives enable row level security;
revoke all on public.student_lesson_objectives from public, anon, authenticated;
grant select, insert, update on public.student_lesson_objectives to authenticated;
-- Only the owning student may track a lesson that is actually published
-- to students. A guessed UUID must not create progress for an unpublished lesson.
create policy student_lesson_objectives_owner_all
  on public.student_lesson_objectives for all to authenticated
  using (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'student'
    )
    and exists (
      select 1 from public.private_student_lessons lesson
      where lesson.id = student_lesson_objectives.lesson_id
        and lesson.is_published = true
    )
  )
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'student'
    )
    and exists (
      select 1 from public.private_student_lessons lesson
      where lesson.id = student_lesson_objectives.lesson_id
        and lesson.is_published = true
    )
  );

insert into public.student_lesson_objectives(student_id, lesson_id, checked_indices)
select state.student_id, lesson.id,
       array(select distinct index_value from (
         select case when value ~ '^[0-9]{1,3}$' then value::integer end as index_value
         from jsonb_array_elements_text(case when jsonb_typeof(entry.value) = 'array' then entry.value else '[]'::jsonb end)
       ) valid where index_value between 0 and 199 order by index_value)
from public.student_learning_state state
cross join lateral jsonb_each(state.lesson_objectives) entry
join public.private_student_lessons lesson on entry.key = 'private-lesson:' || lesson.id::text
on conflict (student_id, lesson_id) do nothing;
