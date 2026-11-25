-- MAIN project only. Save a reply and its question status in a single transaction.
alter table public.teacher_question_messages add column if not exists client_message_id text;
alter table public.teacher_question_messages add constraint teacher_message_client_id_length
  check (client_message_id is null or char_length(client_message_id) between 1 and 200);
create unique index teacher_message_client_id_unique
  on public.teacher_question_messages(sender_id, client_message_id)
  where client_message_id is not null;

create or replace function public.gosvt_send_teacher_reply(
  p_question_id uuid, p_body text, p_client_message_id text, p_expected_sender_id uuid
)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user uuid := auth.uid();
  v_question public.teacher_questions%rowtype;
  v_existing public.teacher_question_messages%rowtype;
  v_role text;
  v_message_id uuid;
begin
  if v_user is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_expected_sender_id is distinct from v_user then raise exception 'session_changed' using errcode = '42501'; end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 8000
     or p_client_message_id is null or char_length(p_client_message_id) not between 1 and 200 then
    raise exception 'invalid_reply' using errcode = '22023';
  end if;
  select role::text into v_role from public.profiles where id = v_user;
  select * into v_question from public.teacher_questions where id = p_question_id for update;
  if not found or not coalesce(
    (v_role = 'student' and v_question.student_id = v_user)
    or (v_role in ('teacher', 'admin') and public.gosvt_can_manage_class(v_question.class_id)), false
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;

  insert into public.teacher_question_messages(question_id, sender_id, body, client_message_id)
  values (p_question_id, v_user, trim(p_body), p_client_message_id)
  on conflict (sender_id, client_message_id) where client_message_id is not null do nothing
  returning id into v_message_id;
  if v_message_id is null then
    select * into v_existing from public.teacher_question_messages
      where sender_id = v_user and client_message_id = p_client_message_id;
    if v_existing.question_id is distinct from p_question_id or v_existing.body is distinct from trim(p_body) then
      raise exception 'reply_token_already_used' using errcode = '22023';
    end if;
    -- A retried old message must not overwrite the status of a newer reply.
    return v_existing.id;
  end if;
  update public.teacher_questions
    set status = case when v_role = 'student' then 'new' else 'answered' end,
        updated_at = now()
    where id = p_question_id;
  return v_message_id;
end;
$function$;
revoke all on function public.gosvt_send_teacher_reply(uuid, text, text, uuid) from public, anon;
grant execute on function public.gosvt_send_teacher_reply(uuid, text, text, uuid) to authenticated;
