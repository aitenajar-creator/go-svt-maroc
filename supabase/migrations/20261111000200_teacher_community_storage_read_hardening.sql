-- Security hardening for the independent teacher-community project.
-- Apply this patch in the NEW teacher-community Supabase project only.
-- Safe to run more than once.

drop policy if exists teacher_community_storage_read on storage.objects;
create policy teacher_community_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'teacher-community'
  and exists (
    select 1
    from public.teacher_community_resources r
    where r.storage_path = storage.objects.name
      and (
        r.owner_id = (select auth.uid())
        or public.gosvt_teacher_community_is_admin()
        or (
          r.is_shared = true
          and r.status = 'published'
          and public.gosvt_teacher_community_is_approved_member()
        )
      )
  )
);

-- Keep the bucket private even if its settings were changed manually.
update storage.buckets
set public = false,
    file_size_limit = 52428800
where id = 'teacher-community';
