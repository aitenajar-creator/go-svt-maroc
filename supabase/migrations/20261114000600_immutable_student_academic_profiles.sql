-- Keep the student's selected level/track in a server-controlled record.
-- auth.users.raw_user_meta_data is user-editable and must not authorize class membership.

create table if not exists public.student_academic_profiles (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  study_level text not null,
  study_track text not null,
  created_at timestamptz not null default now(),
  constraint student_academic_profiles_level_track_check check (
    (study_level = 'TC' and study_track in ('TCS','TCL'))
    or (study_level = '1BAC' and study_track in ('1BACSE','1BACSM','1BACL'))
    or (study_level = '2BAC' and study_track in ('2BACSVT','2BACSP','2BACSM'))
  )
);

alter table public.student_academic_profiles enable row level security;
revoke all on public.student_academic_profiles from public, anon, authenticated;
grant select on public.student_academic_profiles to authenticated;
drop policy if exists student_academic_profiles_read_self_or_admin on public.student_academic_profiles;
create policy student_academic_profiles_read_self_or_admin
  on public.student_academic_profiles
  for select to authenticated
  using (student_id = (select auth.uid()) or public.gosvt_is_site_admin());

-- One-time backfill: preserve valid signup selections already stored for existing students.
-- Invalid/missing metadata is intentionally not guessed; those students can set it once
-- through the guarded RPC below.
insert into public.student_academic_profiles(student_id, study_level, study_track)
select p.id,
       u.raw_user_meta_data->>'study_level',
       u.raw_user_meta_data->>'study_track'
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'student'
  and (
    (u.raw_user_meta_data->>'study_level' = 'TC' and u.raw_user_meta_data->>'study_track' in ('TCS','TCL'))
    or (u.raw_user_meta_data->>'study_level' = '1BAC' and u.raw_user_meta_data->>'study_track' in ('1BACSE','1BACSM','1BACL'))
    or (u.raw_user_meta_data->>'study_level' = '2BAC' and u.raw_user_meta_data->>'study_track' in ('2BACSVT','2BACSP','2BACSM'))
  )
on conflict (student_id) do nothing;

-- New signups get an immutable academic profile from the initial signup selection.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_level text := new.raw_user_meta_data->>'study_level';
  v_track text := new.raw_user_meta_data->>'study_track';
begin
  insert into public.profiles(id, display_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Student'),
    'student'
  )
  on conflict (id) do nothing;

  if (
    (v_level = 'TC' and v_track in ('TCS','TCL'))
    or (v_level = '1BAC' and v_track in ('1BACSE','1BACSM','1BACL'))
    or (v_level = '2BAC' and v_track in ('2BACSVT','2BACSP','2BACSM'))
  ) then
    insert into public.student_academic_profiles(student_id, study_level, study_track)
    values (new.id, v_level, v_track)
    on conflict (student_id) do nothing;
  end if;
  return new;
end;
$function$;

-- Existing students whose academic record was not backfilled may claim it once.
-- There is intentionally no update path after the first successful insert.
create or replace function public.gosvt_set_student_academic_profile(
  p_study_level text,
  p_study_track text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_student uuid := auth.uid();
  v_rows integer;
begin
  if v_student is null then
    raise exception 'authentication_required';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_student and p.role = 'student'
  ) then
    raise exception 'student_account_required';
  end if;
  if not (
    (p_study_level = 'TC' and p_study_track in ('TCS','TCL'))
    or (p_study_level = '1BAC' and p_study_track in ('1BACSE','1BACSM','1BACL'))
    or (p_study_level = '2BAC' and p_study_track in ('2BACSVT','2BACSP','2BACSM'))
  ) then
    raise exception 'invalid_study_level_track';
  end if;

  insert into public.student_academic_profiles(student_id, study_level, study_track)
  values (v_student, p_study_level, p_study_track)
  on conflict (student_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'academic_profile_already_set';
  end if;
end;
$function$;

revoke all on function public.gosvt_set_student_academic_profile(text, text) from public, anon;
grant execute on function public.gosvt_set_student_academic_profile(text, text) to authenticated;

-- Class admission uses the immutable server-controlled academic record, never user metadata.
create or replace function public.gosvt_join_teacher_class(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_student uuid := auth.uid();
  v_class_id uuid;
  v_level text;
  v_track text;
  v_attempt_count integer;
begin
  if v_student is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_student and p.role = 'student'
  ) then
    raise exception 'student_account_required';
  end if;

  select sap.study_level, sap.study_track
    into v_level, v_track
  from public.student_academic_profiles sap
  where sap.student_id = v_student;

  if not found then
    raise exception 'academic_profile_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_student::text, 0));

  delete from public.teacher_class_join_attempts
  where student_id = v_student
    and attempted_at < now() - interval '24 hours';

  select count(*)::integer
    into v_attempt_count
  from public.teacher_class_join_attempts
  where student_id = v_student
    and attempted_at >= now() - interval '15 minutes';

  if v_attempt_count >= 5 then
    raise exception 'join_rate_limited';
  end if;

  select c.id
    into v_class_id
  from public.teacher_classes c
  where c.join_code = upper(trim(coalesce(p_join_code, '')))
    and c.study_level = v_level
    and c.study_track = v_track;

  if v_class_id is null then
    insert into public.teacher_class_join_attempts(student_id) values (v_student);
    return null;
  end if;

  insert into public.teacher_class_students(class_id, student_id)
  values (v_class_id, v_student)
  on conflict (class_id, student_id) do nothing;

  return v_class_id;
end;
$function$;

revoke all on function public.gosvt_join_teacher_class(text) from public, anon;
grant execute on function public.gosvt_join_teacher_class(text) to authenticated;

-- Roster level/track display must use the same immutable record.
create or replace function public.gosvt_teacher_class_roster(p_class_id uuid)
returns table (
  student_id uuid,
  display_name text,
  study_level text,
  study_track text,
  joined_at timestamptz,
  assignment_submissions bigint,
  graded_submissions bigint,
  average_assignment_percentage numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.gosvt_can_manage_class(p_class_id) then
    raise exception 'not_authorized';
  end if;

  return query
  select p.id,
         coalesce(p.display_name, 'Student')::text,
         sap.study_level,
         sap.study_track,
         cs.joined_at,
         coalesce(a.assignment_submissions, 0)::bigint,
         coalesce(a.graded_submissions, 0)::bigint,
         a.average_assignment_percentage
  from public.teacher_class_students cs
  join public.profiles p on p.id = cs.student_id
  left join public.student_academic_profiles sap on sap.student_id = p.id
  left join lateral (
    select count(*)::bigint as assignment_submissions,
           count(*) filter (where s.score is not null)::bigint as graded_submissions,
           round(avg((s.score / 20.0) * 100) filter (where s.score is not null), 1) as average_assignment_percentage
    from public.teacher_assignments ta
    join public.teacher_assignment_submissions s on s.assignment_id = ta.id
    where ta.class_id = p_class_id
      and s.student_id = p.id
  ) a on true
  where cs.class_id = p_class_id
  order by cs.joined_at desc;
end;
$function$;

revoke all on function public.gosvt_teacher_class_roster(uuid) from public, anon;
grant execute on function public.gosvt_teacher_class_roster(uuid) to authenticated;

-- The administrator registry also displays the authoritative academic record.
create or replace function public.gosvt_admin_student_registry()
returns table (
  student_id uuid,
  email text,
  display_name text,
  study_level text,
  study_track text,
  registered_at timestamptz,
  email_confirmed boolean
)
language plpgsql
stable
security definer
set search_path = public, auth
as $function$
begin
  if not public.gosvt_is_site_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select p.id,
         u.email::text,
         coalesce(nullif(p.display_name, ''), nullif(u.raw_user_meta_data->>'display_name', ''), u.email)::text,
         sap.study_level,
         sap.study_track,
         u.created_at,
         (u.email_confirmed_at is not null)
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.student_academic_profiles sap on sap.student_id = p.id
  where p.role = 'student'
  order by u.created_at desc;
end;
$function$;

revoke all on function public.gosvt_admin_student_registry() from public, anon;
grant execute on function public.gosvt_admin_student_registry() to authenticated;
