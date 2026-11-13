-- Evaluate auth.uid() once per statement in remaining straightforward read policies.
-- Keep all staff/class membership helper calls and existing authorization branches unchanged.
alter policy class_students_read_related
  on public.class_students
  using (is_admin() or student_id = (select auth.uid()) or teaches_class(class_id));

alter policy class_teachers_read_related
  on public.class_teachers
  using (is_admin() or teacher_id = (select auth.uid()) or is_student_in_class(class_id));

alter policy exercises_read_allowed
  on public.exercises
  using (
    is_admin()
    or created_by = (select auth.uid())
    or (is_published and (class_id is null or is_student_in_class(class_id)))
    or (class_id is not null and teaches_class(class_id))
  );

alter policy profiles_read_self_or_staff
  on public.profiles
  using (
    id = (select auth.uid())
    or is_admin()
    or exists (
      select 1
      from public.class_students cs
      join public.class_teachers ct on ct.class_id = cs.class_id
      where cs.student_id = profiles.id
        and ct.teacher_id = (select auth.uid())
    )
  );

alter policy profiles_update_self
  on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy questions_read_allowed
  on public.questions
  using (
    exists (
      select 1
      from public.exercises e
      where e.id = questions.exercise_id
        and (
          is_admin()
          or e.created_by = (select auth.uid())
          or (e.is_published and (e.class_id is null or is_student_in_class(e.class_id)))
          or (e.class_id is not null and teaches_class(e.class_id))
        )
    )
  );

alter policy answers_read_related
  on public.student_answers
  using (
    exists (
      select 1
      from public.student_submissions s
      where s.id = student_answers.submission_id
        and (
          s.student_id = (select auth.uid())
          or is_admin()
          or exists (
            select 1
            from public.exercises e
            where e.id = s.exercise_id
              and e.class_id is not null
              and teaches_class(e.class_id)
          )
        )
    )
  );

alter policy submissions_read_related
  on public.student_submissions
  using (
    student_id = (select auth.uid())
    or is_admin()
    or exists (
      select 1
      from public.exercises e
      where e.id = student_submissions.exercise_id
        and e.class_id is not null
        and teaches_class(e.class_id)
    )
  );