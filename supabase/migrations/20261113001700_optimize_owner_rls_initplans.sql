-- Cache the authenticated user id once per statement instead of once per row.
-- These rewrites preserve the original ownership predicates and command scope.
alter policy role_requests_insert_self
  on public.role_change_requests
  with check (
    requested_by = (select auth.uid())
    and status = 'pending'::text
    and reviewed_by is null
    and reviewed_at is null
  );

alter policy role_requests_read_related
  on public.role_change_requests
  using (requested_by = (select auth.uid()) or is_admin());

alter policy "Students can insert their own daily challenges"
  on public.student_daily_challenges
  with check (student_id = (select auth.uid()));

alter policy "Students can read their own daily challenges"
  on public.student_daily_challenges
  using (student_id = (select auth.uid()));

alter policy favorites_owner_all
  on public.student_favorites
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

alter policy notes_owner_all
  on public.student_notes
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

alter policy progress_owner_all
  on public.student_progress
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

alter policy study_plan_owner_all
  on public.student_study_plan
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

alter policy teacher_support_plans_insert
  on public.teacher_student_support_plans
  with check (
    teacher_id = (select auth.uid())
    and gosvt_can_manage_class(class_id)
    and exists (
      select 1
      from public.teacher_class_students s
      where s.class_id = teacher_student_support_plans.class_id
        and s.student_id = teacher_student_support_plans.student_id
    )
  );
