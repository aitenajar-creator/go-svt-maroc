-- Limit repeated class-code guesses per authenticated student.
-- Failed code and study-track checks return NULL so their attempt records commit.
-- A per-student advisory transaction lock makes the rolling-window check race-safe.

create table if not exists public.teacher_class_join_attempts (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists teacher_class_join_attempts_student_time_idx
  on public.teacher_class_join_attempts(student_id, attempted_at desc);

alter table public.teacher_class_join_attempts enable row level security;
revoke all on table public.teacher_class_join_attempts from public, anon, authenticated;

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

  -- Serialize attempts for this student to prevent concurrent requests bypassing the limit.
  perform pg_advisory_xact_lock(hashtextextended(v_student::text, 0));

  delete from public.teacher_class_join_attempts
  where student_id = v_student
    and attempted_at < now() - interval '24 hours';

  insert into public.teacher_class_join_attempts(student_id)
  values (v_student);

  select count(*)::integer
    into v_attempt_count
  from public.teacher_class_join_attempts
  where student_id = v_student
    and attempted_at >= now() - interval '15 minutes';

  if v_attempt_count > 5 then
    raise exception 'join_rate_limited';
  end if;

  select c.id, c.study_level, c.study_track
    into v_class_id, v_level, v_track
  from public.teacher_classes c
  where c.join_code = upper(trim(coalesce(p_join_code, '')));

  -- Return NULL (rather than raising) so the failed attempt is committed and counted.
  if v_class_id is null then
    return null;
  end if;

  if not exists (
    select 1 from auth.users u
    where u.id = v_student
      and coalesce(u.raw_user_meta_data->>'study_level', '') = v_level
      and coalesce(u.raw_user_meta_data->>'study_track', '') = v_track
  ) then
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
