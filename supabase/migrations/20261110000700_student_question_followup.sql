-- Reopen a teacher question when its student sends a follow-up message.
-- The caller can only reopen a question that belongs to their own account.
create or replace function public.gosvt_student_reopen_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.teacher_questions
     set status = 'new',
         updated_at = now()
   where id = p_question_id
     and student_id = auth.uid();

  if not found then
    raise exception 'Question not found or access denied';
  end if;
end;
$$;

revoke all on function public.gosvt_student_reopen_question(uuid) from public;
grant execute on function public.gosvt_student_reopen_question(uuid) to authenticated;
