-- Keep teacher-visible learning indicators scoped to the class they manage.
-- student_progress and student_quiz_attempts are account-wide and have no class_id;
-- do not expose those account-wide aggregates through a class roster or report.

drop function if exists public.gosvt_teacher_class_roster(uuid);
create function public.gosvt_teacher_class_roster(p_class_id uuid)
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
         nullif(u.raw_user_meta_data->>'study_level', '')::text,
         nullif(u.raw_user_meta_data->>'study_track', '')::text,
         cs.joined_at,
         coalesce(a.assignment_submissions, 0)::bigint,
         coalesce(a.graded_submissions, 0)::bigint,
         a.average_assignment_percentage
  from public.teacher_class_students cs
  join public.profiles p on p.id = cs.student_id
  left join auth.users u on u.id = p.id
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

-- Replace the account-wide quiz history trend with a class-assignment-only trend.
drop function if exists public.gosvt_teacher_student_quiz_trend(uuid, uuid);
create function public.gosvt_teacher_student_assignment_trend(
  p_class_id uuid,
  p_student_id uuid
)
returns table (
  submission_date date,
  submission_count bigint,
  graded_submission_count bigint,
  average_percentage numeric,
  best_percentage integer
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null
     or not public.gosvt_can_manage_class(p_class_id)
     or not exists (
       select 1 from public.teacher_class_students cs
       where cs.class_id = p_class_id
         and cs.student_id = p_student_id
     ) then
    raise exception 'not_authorized';
  end if;

  return query
  select daily.submitted_on::date,
         daily.submission_count,
         daily.graded_submission_count,
         daily.average_percentage,
         daily.best_percentage
  from (
    select s.submitted_at::date as submitted_on,
           count(*)::bigint as submission_count,
           count(*) filter (where s.score is not null)::bigint as graded_submission_count,
           round(avg((s.score / 20.0) * 100) filter (where s.score is not null), 1) as average_percentage,
           round(max((s.score / 20.0) * 100) filter (where s.score is not null))::integer as best_percentage
    from public.teacher_assignment_submissions s
    join public.teacher_assignments a on a.id = s.assignment_id
    where a.class_id = p_class_id
      and s.student_id = p_student_id
    group by s.submitted_at::date
    order by s.submitted_at::date desc
    limit 24
  ) daily
  order by daily.submitted_on asc;
end;
$function$;

revoke all on function public.gosvt_teacher_student_assignment_trend(uuid, uuid) from public, anon;
grant execute on function public.gosvt_teacher_student_assignment_trend(uuid, uuid) to authenticated;

-- Direct membership deletion cascades into private teacher notes and support plans.
-- No student-removal workflow exists in the current UI, so block this destructive path.
drop policy if exists teacher_class_students_remove_teacher on public.teacher_class_students;
revoke delete on public.teacher_class_students from authenticated;
