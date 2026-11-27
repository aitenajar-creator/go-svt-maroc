-- Add editable professional details to each existing community membership row.
-- This is an additive migration for the dedicated teacher-community project only.
-- Apply and test in staging before deploying the matching frontend changes.

alter table public.teacher_community_members
  add column if not exists bio text not null default '',
  add column if not exists city text not null default '',
  add column if not exists region text not null default '',
  add column if not exists teaching_levels text[] not null default '{}',
  add column if not exists streams text[] not null default '{}',
  add column if not exists interests text[] not null default '{}',
  add column if not exists skills text[] not null default '{}';

alter table public.teacher_community_members
  add constraint teacher_community_member_bio_length
    check (char_length(bio) <= 1200),
  add constraint teacher_community_member_city_length
    check (char_length(city) <= 100),
  add constraint teacher_community_member_region_length
    check (char_length(region) <= 100),
  add constraint teacher_community_member_teaching_levels_valid
    check (
      cardinality(teaching_levels) <= 3
      and teaching_levels <@ array['tc','1bac','2bac']::text[]
      and array_position(teaching_levels, null) is null
    ),
  add constraint teacher_community_member_streams_valid
    check (
      cardinality(streams) <= 5
      and streams <@ array['experimental','svt','physics','math','other']::text[]
      and array_position(streams, null) is null
    ),
  add constraint teacher_community_member_interests_bounded
    check (
      cardinality(interests) <= 12
      and array_position(interests, null) is null
      and char_length(array_to_string(interests, '')) <= 960
    ),
  add constraint teacher_community_member_skills_bounded
    check (
      cardinality(skills) <= 20
      and array_position(skills, null) is null
      and char_length(array_to_string(skills, '')) <= 1200
    );

-- Administrators who do not yet have a membership row may create their own
-- approved profile; normal self-registration remains pending-only.
drop policy if exists teacher_community_member_register_self
  on public.teacher_community_members;
create policy teacher_community_member_register_self
on public.teacher_community_members
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    status = 'pending'
    or public.gosvt_teacher_community_is_admin()
  )
);

-- Existing members can edit their own professional profile, while status,
-- ownership and membership timestamps remain under administrator control.
drop policy if exists teacher_community_member_update_admin
  on public.teacher_community_members;
create policy teacher_community_member_update_admin
on public.teacher_community_members
for update to authenticated
using (
  user_id = (select auth.uid())
  or public.gosvt_teacher_community_is_admin()
)
with check (
  user_id = (select auth.uid())
  or public.gosvt_teacher_community_is_admin()
);

create or replace function public.gosvt_teacher_community_guard_member_profile_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if public.gosvt_teacher_community_is_admin() then
    return new;
  end if;

  if auth.uid() is null or auth.uid() is distinct from old.user_id then
    raise exception 'teacher_community_profile_owner_required'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id
     or new.status is distinct from old.status
     or new.created_at is distinct from old.created_at then
    raise exception 'teacher_community_membership_fields_are_admin_only'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.gosvt_teacher_community_guard_member_profile_update()
  from public, anon, authenticated;

drop trigger if exists teacher_community_guard_member_profile_update
  on public.teacher_community_members;
create trigger teacher_community_guard_member_profile_update
before update on public.teacher_community_members
for each row execute function public.gosvt_teacher_community_guard_member_profile_update();
