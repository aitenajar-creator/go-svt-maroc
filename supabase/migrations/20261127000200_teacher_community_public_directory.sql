-- Opt-in professional directory for the dedicated teacher-community project.
-- Safe public projection: never expose email, auth identifiers, school name or city.
alter table public.teacher_community_members
  add column if not exists is_profile_public boolean not null default false;

create or replace view public.teacher_community_public_profiles
with (security_barrier = true)
as
select
  display_name,
  professional_title,
  bio,
  region,
  teaching_levels,
  streams,
  interests,
  skills
from public.teacher_community_members
where status = 'approved'
  and is_profile_public = true
  and (
    exists (
      select 1
      from public.teacher_community_members viewer
      where viewer.user_id = (select auth.uid())
        and viewer.status = 'approved'
    )
    or public.gosvt_teacher_community_is_admin()
  );

revoke all on public.teacher_community_public_profiles from public, anon;
grant select on public.teacher_community_public_profiles to authenticated;

comment on view public.teacher_community_public_profiles is
  'Opt-in directory projection for approved teacher-community members; excludes email, user_id, school_name and city.';
