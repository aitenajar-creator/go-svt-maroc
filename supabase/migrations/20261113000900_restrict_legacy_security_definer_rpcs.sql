-- Restrict legacy SECURITY DEFINER RPCs to signed-in callers.
-- Trigger-only and internal helper functions are not exposed as client RPCs.
revoke all on function public."current_role"() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.gosvt_is_site_admin() from public, anon;
grant execute on function public.gosvt_is_site_admin() to authenticated;

revoke all on function public.gosvt_join_teacher_class(text) from public, anon;
grant execute on function public.gosvt_join_teacher_class(text) to authenticated;

revoke all on function public.gosvt_student_classes() from public, anon;
grant execute on function public.gosvt_student_classes() to authenticated;

revoke all on function public.gosvt_student_reopen_question(uuid) from public, anon;
grant execute on function public.gosvt_student_reopen_question(uuid) to authenticated;

revoke all on function public.gosvt_teacher_class_roster(uuid) from public, anon;
grant execute on function public.gosvt_teacher_class_roster(uuid) to authenticated;

revoke all on function public.grade_submission(uuid, numeric, numeric) from public, anon;
grant execute on function public.grade_submission(uuid, numeric, numeric) to authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_student_in_class(uuid) from public, anon;
grant execute on function public.is_student_in_class(uuid) to authenticated;

revoke all on function public.save_answer(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_answer(uuid, uuid, jsonb) to authenticated;

revoke all on function public.start_attempt(uuid) from public, anon;
grant execute on function public.start_attempt(uuid) to authenticated;

revoke all on function public.submit_submission(uuid) from public, anon;
grant execute on function public.submit_submission(uuid) to authenticated;

revoke all on function public.teaches_class(uuid) from public, anon;
grant execute on function public.teaches_class(uuid) to authenticated;
