-- Prevent suspended community members from mutating their own resource metadata
-- or Storage objects. Admins retain moderation and support access.
-- Apply only to the dedicated teacher-community Supabase project.

drop policy if exists teacher_community_resource_update_owner_or_admin
  on public.teacher_community_resources;

create policy teacher_community_resource_update_owner_or_admin
on public.teacher_community_resources
for update to authenticated
using (
  public.gosvt_teacher_community_is_admin()
  or (
    owner_id = (select auth.uid())
    and public.gosvt_teacher_community_is_approved_member()
  )
)
with check (
  public.gosvt_teacher_community_is_admin()
  or (
    owner_id = (select auth.uid())
    and public.gosvt_teacher_community_is_approved_member()
    and (storage.foldername(storage_path))[1] = (select auth.uid())::text
  )
);

drop policy if exists teacher_community_storage_update_own
  on storage.objects;

create policy teacher_community_storage_update_own
on storage.objects
for update to authenticated
using (
  bucket_id = 'teacher-community'
  and (
    public.gosvt_teacher_community_is_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and public.gosvt_teacher_community_is_approved_member()
    )
  )
)
with check (
  bucket_id = 'teacher-community'
  and (
    public.gosvt_teacher_community_is_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and public.gosvt_teacher_community_is_approved_member()
    )
  )
);
