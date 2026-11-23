-- Harden the independent teacher-community project.
-- Remove inherited broad API privileges; RLS does not protect against TRUNCATE.
-- Keep this migration synchronized with the dedicated teacher-community Supabase project.

revoke all privileges on table
  public.teacher_community_members,
  public.teacher_community_resources,
  public.teacher_community_resource_activity
from anon, public, authenticated;

grant select, insert, update
  on table public.teacher_community_members to authenticated;
grant select, insert, update, delete
  on table public.teacher_community_resources to authenticated;
grant select
  on table public.teacher_community_resource_activity to authenticated;

-- Suspended members retain read access to their own resources, but cannot
-- delete resource metadata or Storage objects. Platform admins retain access.
drop policy if exists teacher_community_resource_delete_owner_or_admin
  on public.teacher_community_resources;
create policy teacher_community_resource_delete_owner_or_admin
on public.teacher_community_resources
for delete to authenticated
using (
  public.gosvt_teacher_community_is_admin()
  or (
    owner_id = (select auth.uid())
    and public.gosvt_teacher_community_is_approved_member()
  )
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
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and public.gosvt_teacher_community_is_approved_member()
    )
  )
);
