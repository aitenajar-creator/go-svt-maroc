-- Align resource deletion with the teacher-community suspension UX and
-- prevent replacing existing Storage objects through the browser API.
-- Owners may delete their own files while suspended, but cannot edit/share/upload.

drop policy if exists teacher_community_resource_delete_owner_or_admin
  on public.teacher_community_resources;
create policy teacher_community_resource_delete_owner_or_admin
on public.teacher_community_resources
for delete to authenticated
using (
  public.gosvt_teacher_community_is_admin()
  or owner_id = (select auth.uid())
);

drop policy if exists teacher_community_storage_delete_own
  on storage.objects;
create policy teacher_community_storage_delete_own
on storage.objects
for delete to authenticated
using (
  bucket_id = 'teacher-community'
  and (
    public.gosvt_teacher_community_is_admin()
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

-- The application uploads unique object names and never edits existing objects.
drop policy if exists teacher_community_storage_update_own
  on storage.objects;
