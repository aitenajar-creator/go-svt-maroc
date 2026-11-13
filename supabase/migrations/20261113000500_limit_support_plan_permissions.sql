-- Support plans are currently created and read in the classroom UI only.
-- Remove unused UPDATE/DELETE capabilities while preserving existing plan data.
drop policy if exists teacher_support_plans_update on public.teacher_student_support_plans;
drop policy if exists teacher_support_plans_delete on public.teacher_student_support_plans;

revoke update on public.teacher_student_support_plans from authenticated;
revoke update (
  id, class_id, student_id, teacher_id, title, actions,
  success_criteria, due_at, status, created_at, updated_at
) on public.teacher_student_support_plans from authenticated;
revoke delete on public.teacher_student_support_plans from authenticated;

grant select, insert on public.teacher_student_support_plans to authenticated;
