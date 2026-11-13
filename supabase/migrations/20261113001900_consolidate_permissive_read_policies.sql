-- Consolidate overlapping SELECT policies without changing who can read each row.
-- Authenticated users retain public site content; site admins additionally see hidden rows.
alter policy site_content_admin_read
  on public.site_content_items
  to authenticated
  using (is_deleted = false or gosvt_is_site_admin());

-- The public role needs only published, non-deleted content.
alter policy site_content_public_read
  on public.site_content_items
  to anon
  using (is_deleted = false);

-- Split ALL policies so SELECT authorization is expressed once by the
-- existing access policy (which already includes class managers).
create policy teacher_assignments_insert_manage_class
  on public.teacher_assignments
  for insert
  to authenticated
  with check (
    gosvt_can_manage_class(class_id)
    and created_by = (select auth.uid())
  );

create policy teacher_assignments_update_manage_class
  on public.teacher_assignments
  for update
  to authenticated
  using (gosvt_can_manage_class(class_id))
  with check (
    gosvt_can_manage_class(class_id)
    and created_by = (select auth.uid())
  );

create policy teacher_assignments_delete_manage_class
  on public.teacher_assignments
  for delete
  to authenticated
  using (gosvt_can_manage_class(class_id));

drop policy teacher_assignments_manage_class on public.teacher_assignments;

create policy teacher_review_sessions_insert_manage_teacher
  on public.teacher_review_sessions
  for insert
  to authenticated
  with check (
    gosvt_can_manage_class(class_id)
    and created_by = (select auth.uid())
  );

create policy teacher_review_sessions_update_manage_teacher
  on public.teacher_review_sessions
  for update
  to authenticated
  using (gosvt_can_manage_class(class_id))
  with check (
    gosvt_can_manage_class(class_id)
    and created_by = (select auth.uid())
  );

create policy teacher_review_sessions_delete_manage_teacher
  on public.teacher_review_sessions
  for delete
  to authenticated
  using (gosvt_can_manage_class(class_id));

drop policy teacher_review_sessions_manage_teacher on public.teacher_review_sessions;