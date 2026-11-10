-- GO SVT Maroc: teacher-safe aggregated quiz trend for an enrolled student.
-- Raw attempts, quiz identifiers, and mistake details are never exposed to teachers.
create or replace function public.gosvt_teacher_student_quiz_trend(
  p_class_id uuid,
  p_student_id uuid
)
returns table (
  attempt_date date,
  attempt_count bigint,
  average_percentage numeric,
  best_percentage integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
  select daily.attempted_on::date,
         daily.attempt_count,
         daily.average_percentage,
         daily.best_percentage
  from (
    select sqa.attempted_at::date as attempted_on,
           count(*)::bigint as attempt_count,
           round(avg(sqa.percentage), 1) as average_percentage,
           max(sqa.percentage)::integer as best_percentage
    from public.student_quiz_attempts sqa
    where sqa.student_id = p_student_id
    group by sqa.attempted_at::date
    order by sqa.attempted_at::date desc
    limit 24
  ) daily
  order by daily.attempted_on asc;
end;
$$;

revoke all on function public.gosvt_teacher_student_quiz_trend(uuid, uuid) from public;
revoke all on function public.gosvt_teacher_student_quiz_trend(uuid, uuid) from anon;
grant execute on function public.gosvt_teacher_student_quiz_trend(uuid, uuid) to authenticated;
