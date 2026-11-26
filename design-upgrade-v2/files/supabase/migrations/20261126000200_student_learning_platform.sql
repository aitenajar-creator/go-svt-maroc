-- MAIN Supabase project only. Requires the existing profiles and academic-profile baseline.
-- Training assessments are graded on the server; answer keys and snapshots are not student-readable.
do $preflight$ begin
  if to_regclass('public.profiles') is null or to_regclass('public.student_academic_profiles') is null then
    raise exception 'MAIN project baseline is required; do not apply this to the teacher-community project';
  end if;
end $preflight$;
create or replace function public.gosvt_platform_admin()
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role::text = 'admin') $$;
revoke all on function public.gosvt_platform_admin() from public, anon;
grant execute on function public.gosvt_platform_admin() to authenticated;

create or replace function public.gosvt_platform_valid_tracks(p_level text, p_tracks text[])
returns boolean language sql immutable set search_path = pg_catalog, public
as $$ select coalesce(cardinality(p_tracks) between 1 and 3 and array_position(p_tracks,null) is null and
  case p_level when 'TC' then p_tracks <@ array['TCS','TCL']
    when '1BAC' then p_tracks <@ array['1BACSE','1BACSM','1BACL']
    when '2BAC' then p_tracks <@ array['2BACSVT','2BACSP','2BACSM'] else false end, false) $$;
revoke all on function public.gosvt_platform_valid_tracks(text,text[]) from public, anon;
grant execute on function public.gosvt_platform_valid_tracks(text,text[]) to authenticated;

create table public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 180),
  description text not null default '' check (char_length(description) <= 2000),
  source_url text not null check (char_length(source_url) <= 2048 and source_url ~* '^(https?://|/(cours|exercices|examens|fiches|resumes|lesson-reader\.html))'),
  resource_kind text not null check (resource_kind in ('cours','exercices','resumes','fiches','examens','link')),
  study_level text not null,
  study_tracks text[] not null,
  language text not null default 'arabe' check (language in ('arabe','francais')),
  is_published boolean not null default false,
  position integer not null default 0 check (position between 0 and 9999),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public.gosvt_platform_valid_tracks(study_level,study_tracks))
);
alter table public.learning_resources enable row level security;
revoke all on public.learning_resources from public, anon, authenticated;
grant select on public.learning_resources to authenticated;
grant insert(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position) on public.learning_resources to authenticated;
grant update(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at) on public.learning_resources to authenticated;
create policy learning_resources_read on public.learning_resources for select to authenticated using (
  (select public.gosvt_platform_admin()) or (is_published and exists(select 1 from public.student_academic_profiles p where p.student_id=(select auth.uid()) and p.study_level=learning_resources.study_level and p.study_track=any(learning_resources.study_tracks)))
);
create policy learning_resources_admin_insert on public.learning_resources for insert to authenticated with check ((select public.gosvt_platform_admin()));
create policy learning_resources_admin_update on public.learning_resources for update to authenticated using ((select public.gosvt_platform_admin())) with check ((select public.gosvt_platform_admin()));

create table public.student_learning_events (
  id uuid primary key,
  student_id uuid not null references auth.users(id) on delete cascade,
  event_kind text not null check (event_kind in ('lab','focus')),
  resource_key text not null check (char_length(resource_key) between 1 and 200),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object' and octet_length(payload::text) <= 8000),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index learning_events_owner_time on public.student_learning_events(student_id,occurred_at desc);
alter table public.student_learning_events enable row level security;
revoke all on public.student_learning_events from public, anon, authenticated;
grant select on public.student_learning_events to authenticated;
grant insert(id,student_id,event_kind,resource_key,payload,occurred_at) on public.student_learning_events to authenticated;
create policy learning_events_read on public.student_learning_events for select to authenticated using ((select auth.uid())=student_id);
create policy learning_events_insert on public.student_learning_events for insert to authenticated with check ((select auth.uid())=student_id and exists(select 1 from public.student_academic_profiles where student_id=(select auth.uid())));

create table public.learning_assessments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 180),
  description text not null default '' check (char_length(description)<=2000),
  study_level text not null,
  study_tracks text[] not null,
  duration_minutes integer not null check (duration_minutes between 5 and 180),
  question_count integer not null check (question_count between 0 and 60),
  is_published boolean not null default false,
  check (not is_published or question_count >= 3),
  revision integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check(public.gosvt_platform_valid_tracks(study_level,study_tracks))
);
alter table public.learning_assessments enable row level security;
revoke all on public.learning_assessments from public, anon, authenticated;
grant select on public.learning_assessments to authenticated;
create policy learning_assessments_read on public.learning_assessments for select to authenticated using (
  (select public.gosvt_platform_admin()) or (is_published and exists(select 1 from public.student_academic_profiles p where p.student_id=(select auth.uid()) and p.study_level=learning_assessments.study_level and p.study_track=any(learning_assessments.study_tracks)))
);

create table public.learning_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.learning_assessments(id) on delete cascade,
  position integer not null,
  prompt text not null check (char_length(prompt) between 5 and 4000),
  options text[] not null check (cardinality(options) between 2 and 6 and array_position(options,null) is null),
  answer integer not null check (answer>=0 and answer<cardinality(options)),
  explanation text not null check (char_length(explanation) between 5 and 3000),
  points integer not null default 1 check (points between 1 and 5),
  unique(assessment_id,position)
);
alter table public.learning_questions enable row level security;
revoke all on public.learning_questions from public, anon, authenticated;
grant select on public.learning_questions to authenticated;
create policy learning_questions_admin_read on public.learning_questions for select to authenticated using ((select public.gosvt_platform_admin()));

create table public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null references public.learning_assessments(id),
  title_snapshot text not null,
  question_snapshot jsonb not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  last_sequence integer not null default 0,
  score integer,
  max_score integer not null,
  feedback jsonb
);
create unique index learning_attempt_one_active on public.learning_attempts(student_id,assessment_id) where submitted_at is null;
create index learning_attempt_history on public.learning_attempts(student_id,started_at desc);
alter table public.learning_attempts enable row level security;
revoke all on public.learning_attempts from public, anon, authenticated;
-- The answer-bearing snapshot remains inaccessible even when a student owns the row.
grant select(id,student_id,assessment_id,title_snapshot,started_at,deadline_at,submitted_at,answers,last_sequence,score,max_score,feedback) on public.learning_attempts to authenticated;
create policy learning_attempt_read on public.learning_attempts for select to authenticated using ((select auth.uid())=student_id or (select public.gosvt_platform_admin()));

create or replace function public.gosvt_platform_save_assessment(p_id uuid,p_document jsonb,p_expected_revision integer,p_expected_user uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_tracks text[]; v_count integer; q jsonb; v_options text[]; v_position integer:=0;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user or not public.gosvt_platform_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(p_document->'questions') is distinct from 'array' or jsonb_typeof(p_document->'study_tracks') is distinct from 'array' then raise exception 'invalid_assessment'; end if;
  if coalesce((p_document->>'is_published')::boolean,false) and not coalesce((p_document->>'reviewed')::boolean,false) then raise exception 'editorial_review_required'; end if;
  select array_agg(value) into v_tracks from jsonb_array_elements_text(p_document->'study_tracks');
  v_count:=jsonb_array_length(p_document->'questions');
  if v_count>60 or (coalesce((p_document->>'is_published')::boolean,false) and v_count<3) then raise exception 'assessment_requires_3_to_60_questions_before_publishing'; end if;
  if p_id is null then
    insert into public.learning_assessments(title,description,study_level,study_tracks,duration_minutes,question_count,is_published,created_by)
    values(trim(p_document->>'title'),coalesce(p_document->>'description',''),p_document->>'study_level',v_tracks,(p_document->>'duration_minutes')::integer,v_count,coalesce((p_document->>'is_published')::boolean,false),auth.uid()) returning id into v_id;
  else
    update public.learning_assessments set title=trim(p_document->>'title'),description=coalesce(p_document->>'description',''),study_level=p_document->>'study_level',study_tracks=v_tracks,duration_minutes=(p_document->>'duration_minutes')::integer,question_count=v_count,is_published=coalesce((p_document->>'is_published')::boolean,false),revision=revision+1,updated_at=now()
      where id=p_id and revision=p_expected_revision returning id into v_id;
    if not found then raise exception 'assessment_updated_elsewhere'; end if;
    delete from public.learning_questions where assessment_id=v_id;
  end if;
  for q in select value from jsonb_array_elements(p_document->'questions') loop
    if jsonb_typeof(q) is distinct from 'object' then
      raise exception 'invalid_question';
    end if;
    if jsonb_typeof(q->'prompt') is distinct from 'string' then
      raise exception 'invalid_question';
    end if;
    if jsonb_typeof(q->'explanation') is distinct from 'string' then
      raise exception 'invalid_question';
    end if;
    if jsonb_typeof(q->'options') is distinct from 'array' then
      raise exception 'invalid_question';
    end if;
    if jsonb_typeof(q->'answer') is distinct from 'number' then
      raise exception 'invalid_question';
    end if;
    if (q->>'answer')::numeric <> trunc((q->>'answer')::numeric) then
      raise exception 'invalid_question';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(q->'options') as option_item(value)
      where jsonb_typeof(option_item.value) is distinct from 'string'
    ) then
      raise exception 'invalid_question';
    end if;
    select array_agg(value) into v_options from jsonb_array_elements_text(q->'options');
    if cardinality(v_options) not between 2 and 6 then
      raise exception 'invalid_options';
    end if;
    if exists (
      select 1 from unnest(v_options) as option_item(value)
      where char_length(trim(option_item.value)) not between 1 and 2000
    ) then
      raise exception 'invalid_options';
    end if;
    if (q->>'answer')::integer < 0 or (q->>'answer')::integer >= cardinality(v_options) then
      raise exception 'invalid_options';
    end if;
    insert into public.learning_questions(assessment_id,position,prompt,options,answer,explanation,points)
      values(v_id,v_position,trim(q->>'prompt'),v_options,(q->>'answer')::integer,trim(q->>'explanation'),coalesce((q->>'points')::integer,1));
    v_position:=v_position+1;
  end loop;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_clean_answers(p_snapshot jsonb,p_answers jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare entry record; q jsonb; result jsonb:='{}';
begin
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>12000 then raise exception 'invalid_answers'; end if;
  for entry in select * from jsonb_each(p_answers) loop
    select value into q from jsonb_array_elements(p_snapshot) where value->>'id'=entry.key;
    if q is null or jsonb_typeof(entry.value) is distinct from 'number' or entry.value::text !~ '^[0-9]+$' or (entry.value::text)::integer >= jsonb_array_length(q->'options') then raise exception 'invalid_answer'; end if;
    result:=result||jsonb_build_object(entry.key,entry.value);
  end loop;
  return result;
end $$;
revoke all on function public.gosvt_platform_clean_answers(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.gosvt_platform_start_assessment(p_assessment_id uuid,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.learning_assessments%rowtype; attempt public.learning_attempts%rowtype; snapshot jsonb; total integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_assessment_id::text,0));
  select * into attempt from public.learning_attempts where student_id=auth.uid() and assessment_id=p_assessment_id and submitted_at is null;
  if not found then
    select * into a from public.learning_assessments where id=p_assessment_id and is_published for share;
    if not found or not exists(select 1 from public.student_academic_profiles p where p.student_id=auth.uid() and p.study_level=a.study_level and p.study_track=any(a.study_tracks)) then raise exception 'assessment_not_available_for_profile' using errcode='42501'; end if;
    if (select count(*) from public.learning_attempts where student_id=auth.uid() and started_at>now()-interval '1 hour')>=30 then raise exception 'too_many_attempts'; end if;
    select jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options,'answer',answer,'explanation',explanation,'points',points) order by position),sum(points) into snapshot,total from public.learning_questions where assessment_id=a.id;
    if snapshot is null or jsonb_array_length(snapshot)<3 then raise exception 'assessment_has_no_questions'; end if;
    insert into public.learning_attempts(student_id,assessment_id,title_snapshot,question_snapshot,deadline_at,max_score)
      values(auth.uid(),a.id,a.title,snapshot,now()+make_interval(mins=>a.duration_minutes),total) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'assessment_id',attempt.assessment_id,'deadline_at',attempt.deadline_at,'server_time',now(),'last_sequence',attempt.last_sequence,'answers',attempt.answers,'questions',(select jsonb_agg(value-'answer'-'explanation') from jsonb_array_elements(attempt.question_snapshot)));
end $$;
revoke all on function public.gosvt_platform_start_assessment(uuid,uuid) from public,anon;
grant execute on function public.gosvt_platform_start_assessment(uuid,uuid) to authenticated;

create or replace function public.gosvt_platform_save_answers(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is not null or now()>attempt.deadline_at then raise exception 'attempt_closed'; end if;
  clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
  if p_sequence is null or p_sequence<0 then raise exception 'invalid_sequence'; end if;
  if p_sequence<=attempt.last_sequence then return jsonb_build_object('accepted',p_sequence=attempt.last_sequence and clean=attempt.answers,'last_sequence',attempt.last_sequence); end if;
  update public.learning_attempts set answers=clean,last_sequence=p_sequence where id=attempt.id;
  return jsonb_build_object('accepted',true,'last_sequence',p_sequence);
end $$;
revoke all on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_submit_assessment(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb; q jsonb; selected integer; earned integer; total integer:=0; result jsonb:='[]';
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is null then
    if now()<=attempt.deadline_at then
      if p_sequence is null or p_sequence<attempt.last_sequence then raise exception 'attempt_updated_elsewhere'; end if;
      clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
    else
      -- Once time expires, late payloads cannot replace the answers previously saved on the server.
      clean:=attempt.answers;
    end if;
    for q in select value from jsonb_array_elements(attempt.question_snapshot) loop
      selected:=(clean->>(q->>'id'))::integer;
      earned:=case when selected=(q->>'answer')::integer then (q->>'points')::integer else 0 end;
      total:=total+earned;
      result:=result||jsonb_build_array(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',q->'options','answer',(q->>'answer')::integer,'explanation',q->>'explanation','points',(q->>'points')::integer,'selected',selected,'correct',coalesce(selected=(q->>'answer')::integer,false),'earned',earned));
    end loop;
    update public.learning_attempts set answers=clean,score=total,feedback=result,submitted_at=now(),last_sequence=greatest(last_sequence,coalesce(p_sequence,last_sequence)) where id=attempt.id returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'score',attempt.score,'maximum',attempt.max_score,'percentage',round(100.0*attempt.score/attempt.max_score),'feedback',attempt.feedback,'submitted_at',attempt.submitted_at,'server_graded',true);
end $$;
revoke all on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) to authenticated;

-- Metadata edits are atomic and bound to the administrator who opened the editor.
create or replace function public.gosvt_platform_save_resource(p_id uuid,p_document jsonb,p_expected_user uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_tracks text[];
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user or not public.gosvt_platform_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(p_document->'study_tracks') is distinct from 'array' then raise exception 'invalid_tracks'; end if;
  select array_agg(value) into v_tracks from jsonb_array_elements_text(p_document->'study_tracks');
  if p_id is null then
    insert into public.learning_resources(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,created_by)
    values(trim(p_document->>'title'),coalesce(p_document->>'description',''),trim(p_document->>'source_url'),p_document->>'resource_kind',p_document->>'study_level',v_tracks,p_document->>'language',coalesce((p_document->>'is_published')::boolean,false),coalesce((p_document->>'position')::integer,0),auth.uid()) returning id into v_id;
  else
    update public.learning_resources set title=trim(p_document->>'title'),description=coalesce(p_document->>'description',''),source_url=trim(p_document->>'source_url'),resource_kind=p_document->>'resource_kind',study_level=p_document->>'study_level',study_tracks=v_tracks,language=p_document->>'language',is_published=coalesce((p_document->>'is_published')::boolean,false),position=coalesce((p_document->>'position')::integer,0),updated_at=now()
      where id=p_id and updated_at=(p_document->>'expected_updated_at')::timestamptz returning id into v_id;
    if not found then raise exception 'resource_updated_elsewhere'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) to authenticated;
revoke insert,update on public.learning_resources from authenticated;
revoke insert(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position) on public.learning_resources from authenticated;
revoke update(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at) on public.learning_resources from authenticated;

create or replace function public.gosvt_platform_clean_answers(p_snapshot jsonb,p_answers jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare entry record; q jsonb; result jsonb:='{}';
begin
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>12000 then raise exception 'invalid_answers'; end if;
  for entry in select * from jsonb_each(p_answers) loop
    select value into q from jsonb_array_elements(p_snapshot) where value->>'id'=entry.key;
    if q is null or jsonb_typeof(entry.value) is distinct from 'number' or entry.value::text !~ '^[0-9]+$' or (entry.value::text)::integer >= jsonb_array_length(q->'options') then raise exception 'invalid_answer'; end if;
    result:=result||jsonb_build_object(entry.key,entry.value);
  end loop;
  return result;
end $$;
revoke all on function public.gosvt_platform_clean_answers(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.gosvt_platform_start_assessment(p_assessment_id uuid,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.learning_assessments%rowtype; attempt public.learning_attempts%rowtype; snapshot jsonb; total integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_assessment_id::text,0));
  select * into attempt from public.learning_attempts where student_id=auth.uid() and assessment_id=p_assessment_id and submitted_at is null;
  if not found then
    select * into a from public.learning_assessments where id=p_assessment_id and is_published for share;
    if not found or not exists(select 1 from public.student_academic_profiles p where p.student_id=auth.uid() and p.study_level=a.study_level and p.study_track=any(a.study_tracks)) then raise exception 'assessment_not_available_for_profile' using errcode='42501'; end if;
    if (select count(*) from public.learning_attempts where student_id=auth.uid() and started_at>now()-interval '1 hour')>=30 then raise exception 'too_many_attempts'; end if;
    select jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options,'answer',answer,'explanation',explanation,'points',points) order by position),sum(points) into snapshot,total from public.learning_questions where assessment_id=a.id;
    if snapshot is null or jsonb_array_length(snapshot)<3 then raise exception 'assessment_has_no_questions'; end if;
    insert into public.learning_attempts(student_id,assessment_id,title_snapshot,question_snapshot,deadline_at,max_score)
      values(auth.uid(),a.id,a.title,snapshot,now()+make_interval(mins=>a.duration_minutes),total) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'assessment_id',attempt.assessment_id,'deadline_at',attempt.deadline_at,'server_time',now(),'last_sequence',attempt.last_sequence,'answers',attempt.answers,'questions',(select jsonb_agg(value-'answer'-'explanation') from jsonb_array_elements(attempt.question_snapshot)));
end $$;
revoke all on function public.gosvt_platform_start_assessment(uuid,uuid) from public,anon;
grant execute on function public.gosvt_platform_start_assessment(uuid,uuid) to authenticated;

create or replace function public.gosvt_platform_save_answers(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is not null or now()>attempt.deadline_at then raise exception 'attempt_closed'; end if;
  clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
  if p_sequence is null or p_sequence<0 then raise exception 'invalid_sequence'; end if;
  if p_sequence<=attempt.last_sequence then return jsonb_build_object('accepted',p_sequence=attempt.last_sequence and clean=attempt.answers,'last_sequence',attempt.last_sequence); end if;
  update public.learning_attempts set answers=clean,last_sequence=p_sequence where id=attempt.id;
  return jsonb_build_object('accepted',true,'last_sequence',p_sequence);
end $$;
revoke all on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_submit_assessment(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb; q jsonb; selected integer; earned integer; total integer:=0; result jsonb:='[]';
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is null then
    if now()<=attempt.deadline_at then
      if p_sequence is null or p_sequence<attempt.last_sequence then raise exception 'attempt_updated_elsewhere'; end if;
      clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
    else
      -- Once time expires, late payloads cannot replace the answers previously saved on the server.
      clean:=attempt.answers;
    end if;
    for q in select value from jsonb_array_elements(attempt.question_snapshot) loop
      selected:=(clean->>(q->>'id'))::integer;
      earned:=case when selected=(q->>'answer')::integer then (q->>'points')::integer else 0 end;
      total:=total+earned;
      result:=result||jsonb_build_array(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',q->'options','answer',(q->>'answer')::integer,'explanation',q->>'explanation','points',(q->>'points')::integer,'selected',selected,'correct',coalesce(selected=(q->>'answer')::integer,false),'earned',earned));
    end loop;
    update public.learning_attempts set answers=clean,score=total,feedback=result,submitted_at=now(),last_sequence=greatest(last_sequence,coalesce(p_sequence,last_sequence)) where id=attempt.id returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'score',attempt.score,'maximum',attempt.max_score,'percentage',round(100.0*attempt.score/attempt.max_score),'feedback',attempt.feedback,'submitted_at',attempt.submitted_at,'server_graded',true);
end $$;
revoke all on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) to authenticated;

-- Metadata edits are atomic and bound to the administrator who opened the editor.
create or replace function public.gosvt_platform_save_resource(p_id uuid,p_document jsonb,p_expected_user uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_tracks text[];
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user or not public.gosvt_platform_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(p_document->'study_tracks') is distinct from 'array' then raise exception 'invalid_tracks'; end if;
  select array_agg(value) into v_tracks from jsonb_array_elements_text(p_document->'study_tracks');
  if p_id is null then
    insert into public.learning_resources(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,created_by)
    values(trim(p_document->>'title'),coalesce(p_document->>'description',''),trim(p_document->>'source_url'),p_document->>'resource_kind',p_document->>'study_level',v_tracks,p_document->>'language',coalesce((p_document->>'is_published')::boolean,false),coalesce((p_document->>'position')::integer,0),auth.uid()) returning id into v_id;
  else
    update public.learning_resources set title=trim(p_document->>'title'),description=coalesce(p_document->>'description',''),source_url=trim(p_document->>'source_url'),resource_kind=p_document->>'resource_kind',study_level=p_document->>'study_level',study_tracks=v_tracks,language=p_document->>'language',is_published=coalesce((p_document->>'is_published')::boolean,false),position=coalesce((p_document->>'position')::integer,0),updated_at=now()
      where id=p_id and updated_at=(p_document->>'expected_updated_at')::timestamptz returning id into v_id;
    if not found then raise exception 'resource_updated_elsewhere'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) to authenticated;
revoke insert,update on public.learning_resources from authenticated;
revoke insert(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position) on public.learning_resources from authenticated;
revoke update(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at) on public.learning_resources from authenticated;
 then raise exception 'invalid_question'; end if;
    select array_agg(value) into v_options from jsonb_array_elements_text(q->'options');
    if exists(select 1 from unnest(v_options) opt where char_length(trim(opt)) not between 1 and 2000) or (q->>'answer') !~ '^[0-9]+$' then raise exception 'invalid_options'; end if;
    insert into public.learning_questions(assessment_id,position,prompt,options,answer,explanation,points)
      values(v_id,v_position,trim(q->>'prompt'),v_options,(q->>'answer')::integer,trim(q->>'explanation'),coalesce((q->>'points')::integer,1));
    v_position:=v_position+1;
  end loop;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_clean_answers(p_snapshot jsonb,p_answers jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare entry record; q jsonb; result jsonb:='{}';
begin
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>12000 then raise exception 'invalid_answers'; end if;
  for entry in select * from jsonb_each(p_answers) loop
    select value into q from jsonb_array_elements(p_snapshot) where value->>'id'=entry.key;
    if q is null or jsonb_typeof(entry.value) is distinct from 'number' or entry.value::text !~ '^[0-9]+$' or (entry.value::text)::integer >= jsonb_array_length(q->'options') then raise exception 'invalid_answer'; end if;
    result:=result||jsonb_build_object(entry.key,entry.value);
  end loop;
  return result;
end $$;
revoke all on function public.gosvt_platform_clean_answers(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.gosvt_platform_start_assessment(p_assessment_id uuid,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.learning_assessments%rowtype; attempt public.learning_attempts%rowtype; snapshot jsonb; total integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_assessment_id::text,0));
  select * into attempt from public.learning_attempts where student_id=auth.uid() and assessment_id=p_assessment_id and submitted_at is null;
  if not found then
    select * into a from public.learning_assessments where id=p_assessment_id and is_published for share;
    if not found or not exists(select 1 from public.student_academic_profiles p where p.student_id=auth.uid() and p.study_level=a.study_level and p.study_track=any(a.study_tracks)) then raise exception 'assessment_not_available_for_profile' using errcode='42501'; end if;
    if (select count(*) from public.learning_attempts where student_id=auth.uid() and started_at>now()-interval '1 hour')>=30 then raise exception 'too_many_attempts'; end if;
    select jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options,'answer',answer,'explanation',explanation,'points',points) order by position),sum(points) into snapshot,total from public.learning_questions where assessment_id=a.id;
    if snapshot is null or jsonb_array_length(snapshot)<3 then raise exception 'assessment_has_no_questions'; end if;
    insert into public.learning_attempts(student_id,assessment_id,title_snapshot,question_snapshot,deadline_at,max_score)
      values(auth.uid(),a.id,a.title,snapshot,now()+make_interval(mins=>a.duration_minutes),total) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'assessment_id',attempt.assessment_id,'deadline_at',attempt.deadline_at,'server_time',now(),'last_sequence',attempt.last_sequence,'answers',attempt.answers,'questions',(select jsonb_agg(value-'answer'-'explanation') from jsonb_array_elements(attempt.question_snapshot)));
end $$;
revoke all on function public.gosvt_platform_start_assessment(uuid,uuid) from public,anon;
grant execute on function public.gosvt_platform_start_assessment(uuid,uuid) to authenticated;

create or replace function public.gosvt_platform_save_answers(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is not null or now()>attempt.deadline_at then raise exception 'attempt_closed'; end if;
  clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
  if p_sequence is null or p_sequence<0 then raise exception 'invalid_sequence'; end if;
  if p_sequence<=attempt.last_sequence then return jsonb_build_object('accepted',p_sequence=attempt.last_sequence and clean=attempt.answers,'last_sequence',attempt.last_sequence); end if;
  update public.learning_attempts set answers=clean,last_sequence=p_sequence where id=attempt.id;
  return jsonb_build_object('accepted',true,'last_sequence',p_sequence);
end $$;
revoke all on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_submit_assessment(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb; q jsonb; selected integer; earned integer; total integer:=0; result jsonb:='[]';
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is null then
    if now()<=attempt.deadline_at then
      if p_sequence is null or p_sequence<attempt.last_sequence then raise exception 'attempt_updated_elsewhere'; end if;
      clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
    else
      -- Once time expires, late payloads cannot replace the answers previously saved on the server.
      clean:=attempt.answers;
    end if;
    for q in select value from jsonb_array_elements(attempt.question_snapshot) loop
      selected:=(clean->>(q->>'id'))::integer;
      earned:=case when selected=(q->>'answer')::integer then (q->>'points')::integer else 0 end;
      total:=total+earned;
      result:=result||jsonb_build_array(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',q->'options','answer',(q->>'answer')::integer,'explanation',q->>'explanation','points',(q->>'points')::integer,'selected',selected,'correct',coalesce(selected=(q->>'answer')::integer,false),'earned',earned));
    end loop;
    update public.learning_attempts set answers=clean,score=total,feedback=result,submitted_at=now(),last_sequence=greatest(last_sequence,coalesce(p_sequence,last_sequence)) where id=attempt.id returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'score',attempt.score,'maximum',attempt.max_score,'percentage',round(100.0*attempt.score/attempt.max_score),'feedback',attempt.feedback,'submitted_at',attempt.submitted_at,'server_graded',true);
end $$;
revoke all on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) to authenticated;

-- Metadata edits are atomic and bound to the administrator who opened the editor.
create or replace function public.gosvt_platform_save_resource(p_id uuid,p_document jsonb,p_expected_user uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_tracks text[];
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user or not public.gosvt_platform_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(p_document->'study_tracks') is distinct from 'array' then raise exception 'invalid_tracks'; end if;
  select array_agg(value) into v_tracks from jsonb_array_elements_text(p_document->'study_tracks');
  if p_id is null then
    insert into public.learning_resources(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,created_by)
    values(trim(p_document->>'title'),coalesce(p_document->>'description',''),trim(p_document->>'source_url'),p_document->>'resource_kind',p_document->>'study_level',v_tracks,p_document->>'language',coalesce((p_document->>'is_published')::boolean,false),coalesce((p_document->>'position')::integer,0),auth.uid()) returning id into v_id;
  else
    update public.learning_resources set title=trim(p_document->>'title'),description=coalesce(p_document->>'description',''),source_url=trim(p_document->>'source_url'),resource_kind=p_document->>'resource_kind',study_level=p_document->>'study_level',study_tracks=v_tracks,language=p_document->>'language',is_published=coalesce((p_document->>'is_published')::boolean,false),position=coalesce((p_document->>'position')::integer,0),updated_at=now()
      where id=p_id and updated_at=(p_document->>'expected_updated_at')::timestamptz returning id into v_id;
    if not found then raise exception 'resource_updated_elsewhere'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) to authenticated;
revoke insert,update on public.learning_resources from authenticated;
revoke insert(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position) on public.learning_resources from authenticated;
revoke update(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at) on public.learning_resources from authenticated;
 then raise exception 'invalid_question'; end if;
    select array_agg(value) into v_options from jsonb_array_elements_text(q->'options');
    if exists(select 1 from unnest(v_options) opt where char_length(trim(opt)) not between 1 and 2000) or (q->>'answer') !~ '^[0-9]+$' then raise exception 'invalid_options'; end if;
    insert into public.learning_questions(assessment_id,position,prompt,options,answer,explanation,points)
      values(v_id,v_position,trim(q->>'prompt'),v_options,(q->>'answer')::integer,trim(q->>'explanation'),coalesce((q->>'points')::integer,1));
    v_position:=v_position+1;
  end loop;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_clean_answers(p_snapshot jsonb,p_answers jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare entry record; q jsonb; result jsonb:='{}';
begin
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>12000 then raise exception 'invalid_answers'; end if;
  for entry in select * from jsonb_each(p_answers) loop
    select value into q from jsonb_array_elements(p_snapshot) where value->>'id'=entry.key;
    if q is null or jsonb_typeof(entry.value) is distinct from 'number' or entry.value::text !~ '^[0-9]+$' or (entry.value::text)::integer >= jsonb_array_length(q->'options') then raise exception 'invalid_answer'; end if;
    result:=result||jsonb_build_object(entry.key,entry.value);
  end loop;
  return result;
end $$;
revoke all on function public.gosvt_platform_clean_answers(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.gosvt_platform_start_assessment(p_assessment_id uuid,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.learning_assessments%rowtype; attempt public.learning_attempts%rowtype; snapshot jsonb; total integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_assessment_id::text,0));
  select * into attempt from public.learning_attempts where student_id=auth.uid() and assessment_id=p_assessment_id and submitted_at is null;
  if not found then
    select * into a from public.learning_assessments where id=p_assessment_id and is_published for share;
    if not found or not exists(select 1 from public.student_academic_profiles p where p.student_id=auth.uid() and p.study_level=a.study_level and p.study_track=any(a.study_tracks)) then raise exception 'assessment_not_available_for_profile' using errcode='42501'; end if;
    if (select count(*) from public.learning_attempts where student_id=auth.uid() and started_at>now()-interval '1 hour')>=30 then raise exception 'too_many_attempts'; end if;
    select jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options,'answer',answer,'explanation',explanation,'points',points) order by position),sum(points) into snapshot,total from public.learning_questions where assessment_id=a.id;
    if snapshot is null or jsonb_array_length(snapshot)<3 then raise exception 'assessment_has_no_questions'; end if;
    insert into public.learning_attempts(student_id,assessment_id,title_snapshot,question_snapshot,deadline_at,max_score)
      values(auth.uid(),a.id,a.title,snapshot,now()+make_interval(mins=>a.duration_minutes),total) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'assessment_id',attempt.assessment_id,'deadline_at',attempt.deadline_at,'server_time',now(),'last_sequence',attempt.last_sequence,'answers',attempt.answers,'questions',(select jsonb_agg(value-'answer'-'explanation') from jsonb_array_elements(attempt.question_snapshot)));
end $$;
revoke all on function public.gosvt_platform_start_assessment(uuid,uuid) from public,anon;
grant execute on function public.gosvt_platform_start_assessment(uuid,uuid) to authenticated;

create or replace function public.gosvt_platform_save_answers(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is not null or now()>attempt.deadline_at then raise exception 'attempt_closed'; end if;
  clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
  if p_sequence is null or p_sequence<0 then raise exception 'invalid_sequence'; end if;
  if p_sequence<=attempt.last_sequence then return jsonb_build_object('accepted',p_sequence=attempt.last_sequence and clean=attempt.answers,'last_sequence',attempt.last_sequence); end if;
  update public.learning_attempts set answers=clean,last_sequence=p_sequence where id=attempt.id;
  return jsonb_build_object('accepted',true,'last_sequence',p_sequence);
end $$;
revoke all on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_submit_assessment(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb; q jsonb; selected integer; earned integer; total integer:=0; result jsonb:='[]';
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is null then
    if now()<=attempt.deadline_at then
      if p_sequence is null or p_sequence<attempt.last_sequence then raise exception 'attempt_updated_elsewhere'; end if;
      clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
    else
      -- Once time expires, late payloads cannot replace the answers previously saved on the server.
      clean:=attempt.answers;
    end if;
    for q in select value from jsonb_array_elements(attempt.question_snapshot) loop
      selected:=(clean->>(q->>'id'))::integer;
      earned:=case when selected=(q->>'answer')::integer then (q->>'points')::integer else 0 end;
      total:=total+earned;
      result:=result||jsonb_build_array(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',q->'options','answer',(q->>'answer')::integer,'explanation',q->>'explanation','points',(q->>'points')::integer,'selected',selected,'correct',coalesce(selected=(q->>'answer')::integer,false),'earned',earned));
    end loop;
    update public.learning_attempts set answers=clean,score=total,feedback=result,submitted_at=now(),last_sequence=greatest(last_sequence,coalesce(p_sequence,last_sequence)) where id=attempt.id returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'score',attempt.score,'maximum',attempt.max_score,'percentage',round(100.0*attempt.score/attempt.max_score),'feedback',attempt.feedback,'submitted_at',attempt.submitted_at,'server_graded',true);
end $$;
revoke all on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) to authenticated;

-- Metadata edits are atomic and bound to the administrator who opened the editor.
create or replace function public.gosvt_platform_save_resource(p_id uuid,p_document jsonb,p_expected_user uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_tracks text[];
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user or not public.gosvt_platform_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(p_document->'study_tracks') is distinct from 'array' then raise exception 'invalid_tracks'; end if;
  select array_agg(value) into v_tracks from jsonb_array_elements_text(p_document->'study_tracks');
  if p_id is null then
    insert into public.learning_resources(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,created_by)
    values(trim(p_document->>'title'),coalesce(p_document->>'description',''),trim(p_document->>'source_url'),p_document->>'resource_kind',p_document->>'study_level',v_tracks,p_document->>'language',coalesce((p_document->>'is_published')::boolean,false),coalesce((p_document->>'position')::integer,0),auth.uid()) returning id into v_id;
  else
    update public.learning_resources set title=trim(p_document->>'title'),description=coalesce(p_document->>'description',''),source_url=trim(p_document->>'source_url'),resource_kind=p_document->>'resource_kind',study_level=p_document->>'study_level',study_tracks=v_tracks,language=p_document->>'language',is_published=coalesce((p_document->>'is_published')::boolean,false),position=coalesce((p_document->>'position')::integer,0),updated_at=now()
      where id=p_id and updated_at=(p_document->>'expected_updated_at')::timestamptz returning id into v_id;
    if not found then raise exception 'resource_updated_elsewhere'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) to authenticated;
revoke insert,update on public.learning_resources from authenticated;
revoke insert(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position) on public.learning_resources from authenticated;
revoke update(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at) on public.learning_resources from authenticated;
 then
      raise exception 'invalid_question';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(q->'options') as option_item(value)
      where jsonb_typeof(option_item.value) is distinct from 'string'
    ) then
      raise exception 'invalid_question';
    end if;
    select array_agg(value) into v_options from jsonb_array_elements_text(q->'options');
    if cardinality(v_options) not between 2 and 6 then
      raise exception 'invalid_options';
    end if;
    if exists (
      select 1 from unnest(v_options) as option_item(value)
      where char_length(trim(option_item.value)) not between 1 and 2000
    ) then
      raise exception 'invalid_options';
    end if;
    if (q->>'answer')::integer < 0 or (q->>'answer')::integer >= cardinality(v_options) then
      raise exception 'invalid_options';
    end if;
    insert into public.learning_questions(assessment_id,position,prompt,options,answer,explanation,points)
      values(v_id,v_position,trim(q->>'prompt'),v_options,(q->>'answer')::integer,trim(q->>'explanation'),coalesce((q->>'points')::integer,1));
    v_position:=v_position+1;
  end loop;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_clean_answers(p_snapshot jsonb,p_answers jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare entry record; q jsonb; result jsonb:='{}';
begin
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>12000 then raise exception 'invalid_answers'; end if;
  for entry in select * from jsonb_each(p_answers) loop
    select value into q from jsonb_array_elements(p_snapshot) where value->>'id'=entry.key;
    if q is null or jsonb_typeof(entry.value) is distinct from 'number' or entry.value::text !~ '^[0-9]+$' or (entry.value::text)::integer >= jsonb_array_length(q->'options') then raise exception 'invalid_answer'; end if;
    result:=result||jsonb_build_object(entry.key,entry.value);
  end loop;
  return result;
end $$;
revoke all on function public.gosvt_platform_clean_answers(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.gosvt_platform_start_assessment(p_assessment_id uuid,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.learning_assessments%rowtype; attempt public.learning_attempts%rowtype; snapshot jsonb; total integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_assessment_id::text,0));
  select * into attempt from public.learning_attempts where student_id=auth.uid() and assessment_id=p_assessment_id and submitted_at is null;
  if not found then
    select * into a from public.learning_assessments where id=p_assessment_id and is_published for share;
    if not found or not exists(select 1 from public.student_academic_profiles p where p.student_id=auth.uid() and p.study_level=a.study_level and p.study_track=any(a.study_tracks)) then raise exception 'assessment_not_available_for_profile' using errcode='42501'; end if;
    if (select count(*) from public.learning_attempts where student_id=auth.uid() and started_at>now()-interval '1 hour')>=30 then raise exception 'too_many_attempts'; end if;
    select jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options,'answer',answer,'explanation',explanation,'points',points) order by position),sum(points) into snapshot,total from public.learning_questions where assessment_id=a.id;
    if snapshot is null or jsonb_array_length(snapshot)<3 then raise exception 'assessment_has_no_questions'; end if;
    insert into public.learning_attempts(student_id,assessment_id,title_snapshot,question_snapshot,deadline_at,max_score)
      values(auth.uid(),a.id,a.title,snapshot,now()+make_interval(mins=>a.duration_minutes),total) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'assessment_id',attempt.assessment_id,'deadline_at',attempt.deadline_at,'server_time',now(),'last_sequence',attempt.last_sequence,'answers',attempt.answers,'questions',(select jsonb_agg(value-'answer'-'explanation') from jsonb_array_elements(attempt.question_snapshot)));
end $$;
revoke all on function public.gosvt_platform_start_assessment(uuid,uuid) from public,anon;
grant execute on function public.gosvt_platform_start_assessment(uuid,uuid) to authenticated;

create or replace function public.gosvt_platform_save_answers(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is not null or now()>attempt.deadline_at then raise exception 'attempt_closed'; end if;
  clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
  if p_sequence is null or p_sequence<0 then raise exception 'invalid_sequence'; end if;
  if p_sequence<=attempt.last_sequence then return jsonb_build_object('accepted',p_sequence=attempt.last_sequence and clean=attempt.answers,'last_sequence',attempt.last_sequence); end if;
  update public.learning_attempts set answers=clean,last_sequence=p_sequence where id=attempt.id;
  return jsonb_build_object('accepted',true,'last_sequence',p_sequence);
end $$;
revoke all on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_submit_assessment(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb; q jsonb; selected integer; earned integer; total integer:=0; result jsonb:='[]';
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is null then
    if now()<=attempt.deadline_at then
      if p_sequence is null or p_sequence<attempt.last_sequence then raise exception 'attempt_updated_elsewhere'; end if;
      clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
    else
      -- Once time expires, late payloads cannot replace the answers previously saved on the server.
      clean:=attempt.answers;
    end if;
    for q in select value from jsonb_array_elements(attempt.question_snapshot) loop
      selected:=(clean->>(q->>'id'))::integer;
      earned:=case when selected=(q->>'answer')::integer then (q->>'points')::integer else 0 end;
      total:=total+earned;
      result:=result||jsonb_build_array(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',q->'options','answer',(q->>'answer')::integer,'explanation',q->>'explanation','points',(q->>'points')::integer,'selected',selected,'correct',coalesce(selected=(q->>'answer')::integer,false),'earned',earned));
    end loop;
    update public.learning_attempts set answers=clean,score=total,feedback=result,submitted_at=now(),last_sequence=greatest(last_sequence,coalesce(p_sequence,last_sequence)) where id=attempt.id returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'score',attempt.score,'maximum',attempt.max_score,'percentage',round(100.0*attempt.score/attempt.max_score),'feedback',attempt.feedback,'submitted_at',attempt.submitted_at,'server_graded',true);
end $$;
revoke all on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) to authenticated;

-- Metadata edits are atomic and bound to the administrator who opened the editor.
create or replace function public.gosvt_platform_save_resource(p_id uuid,p_document jsonb,p_expected_user uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_tracks text[];
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user or not public.gosvt_platform_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(p_document->'study_tracks') is distinct from 'array' then raise exception 'invalid_tracks'; end if;
  select array_agg(value) into v_tracks from jsonb_array_elements_text(p_document->'study_tracks');
  if p_id is null then
    insert into public.learning_resources(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,created_by)
    values(trim(p_document->>'title'),coalesce(p_document->>'description',''),trim(p_document->>'source_url'),p_document->>'resource_kind',p_document->>'study_level',v_tracks,p_document->>'language',coalesce((p_document->>'is_published')::boolean,false),coalesce((p_document->>'position')::integer,0),auth.uid()) returning id into v_id;
  else
    update public.learning_resources set title=trim(p_document->>'title'),description=coalesce(p_document->>'description',''),source_url=trim(p_document->>'source_url'),resource_kind=p_document->>'resource_kind',study_level=p_document->>'study_level',study_tracks=v_tracks,language=p_document->>'language',is_published=coalesce((p_document->>'is_published')::boolean,false),position=coalesce((p_document->>'position')::integer,0),updated_at=now()
      where id=p_id and updated_at=(p_document->>'expected_updated_at')::timestamptz returning id into v_id;
    if not found then raise exception 'resource_updated_elsewhere'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) to authenticated;
revoke insert,update on public.learning_resources from authenticated;
revoke insert(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position) on public.learning_resources from authenticated;
revoke update(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at) on public.learning_resources from authenticated;
 then raise exception 'invalid_question'; end if;
    select array_agg(value) into v_options from jsonb_array_elements_text(q->'options');
    if exists(select 1 from unnest(v_options) opt where char_length(trim(opt)) not between 1 and 2000) or (q->>'answer') !~ '^[0-9]+$' then raise exception 'invalid_options'; end if;
    insert into public.learning_questions(assessment_id,position,prompt,options,answer,explanation,points)
      values(v_id,v_position,trim(q->>'prompt'),v_options,(q->>'answer')::integer,trim(q->>'explanation'),coalesce((q->>'points')::integer,1));
    v_position:=v_position+1;
  end loop;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_clean_answers(p_snapshot jsonb,p_answers jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare entry record; q jsonb; result jsonb:='{}';
begin
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>12000 then raise exception 'invalid_answers'; end if;
  for entry in select * from jsonb_each(p_answers) loop
    select value into q from jsonb_array_elements(p_snapshot) where value->>'id'=entry.key;
    if q is null or jsonb_typeof(entry.value) is distinct from 'number' or entry.value::text !~ '^[0-9]+$' or (entry.value::text)::integer >= jsonb_array_length(q->'options') then raise exception 'invalid_answer'; end if;
    result:=result||jsonb_build_object(entry.key,entry.value);
  end loop;
  return result;
end $$;
revoke all on function public.gosvt_platform_clean_answers(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.gosvt_platform_start_assessment(p_assessment_id uuid,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.learning_assessments%rowtype; attempt public.learning_attempts%rowtype; snapshot jsonb; total integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_assessment_id::text,0));
  select * into attempt from public.learning_attempts where student_id=auth.uid() and assessment_id=p_assessment_id and submitted_at is null;
  if not found then
    select * into a from public.learning_assessments where id=p_assessment_id and is_published for share;
    if not found or not exists(select 1 from public.student_academic_profiles p where p.student_id=auth.uid() and p.study_level=a.study_level and p.study_track=any(a.study_tracks)) then raise exception 'assessment_not_available_for_profile' using errcode='42501'; end if;
    if (select count(*) from public.learning_attempts where student_id=auth.uid() and started_at>now()-interval '1 hour')>=30 then raise exception 'too_many_attempts'; end if;
    select jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options,'answer',answer,'explanation',explanation,'points',points) order by position),sum(points) into snapshot,total from public.learning_questions where assessment_id=a.id;
    if snapshot is null or jsonb_array_length(snapshot)<3 then raise exception 'assessment_has_no_questions'; end if;
    insert into public.learning_attempts(student_id,assessment_id,title_snapshot,question_snapshot,deadline_at,max_score)
      values(auth.uid(),a.id,a.title,snapshot,now()+make_interval(mins=>a.duration_minutes),total) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'assessment_id',attempt.assessment_id,'deadline_at',attempt.deadline_at,'server_time',now(),'last_sequence',attempt.last_sequence,'answers',attempt.answers,'questions',(select jsonb_agg(value-'answer'-'explanation') from jsonb_array_elements(attempt.question_snapshot)));
end $$;
revoke all on function public.gosvt_platform_start_assessment(uuid,uuid) from public,anon;
grant execute on function public.gosvt_platform_start_assessment(uuid,uuid) to authenticated;

create or replace function public.gosvt_platform_save_answers(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is not null or now()>attempt.deadline_at then raise exception 'attempt_closed'; end if;
  clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
  if p_sequence is null or p_sequence<0 then raise exception 'invalid_sequence'; end if;
  if p_sequence<=attempt.last_sequence then return jsonb_build_object('accepted',p_sequence=attempt.last_sequence and clean=attempt.answers,'last_sequence',attempt.last_sequence); end if;
  update public.learning_attempts set answers=clean,last_sequence=p_sequence where id=attempt.id;
  return jsonb_build_object('accepted',true,'last_sequence',p_sequence);
end $$;
revoke all on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_submit_assessment(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb; q jsonb; selected integer; earned integer; total integer:=0; result jsonb:='[]';
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is null then
    if now()<=attempt.deadline_at then
      if p_sequence is null or p_sequence<attempt.last_sequence then raise exception 'attempt_updated_elsewhere'; end if;
      clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
    else
      -- Once time expires, late payloads cannot replace the answers previously saved on the server.
      clean:=attempt.answers;
    end if;
    for q in select value from jsonb_array_elements(attempt.question_snapshot) loop
      selected:=(clean->>(q->>'id'))::integer;
      earned:=case when selected=(q->>'answer')::integer then (q->>'points')::integer else 0 end;
      total:=total+earned;
      result:=result||jsonb_build_array(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',q->'options','answer',(q->>'answer')::integer,'explanation',q->>'explanation','points',(q->>'points')::integer,'selected',selected,'correct',coalesce(selected=(q->>'answer')::integer,false),'earned',earned));
    end loop;
    update public.learning_attempts set answers=clean,score=total,feedback=result,submitted_at=now(),last_sequence=greatest(last_sequence,coalesce(p_sequence,last_sequence)) where id=attempt.id returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'score',attempt.score,'maximum',attempt.max_score,'percentage',round(100.0*attempt.score/attempt.max_score),'feedback',attempt.feedback,'submitted_at',attempt.submitted_at,'server_graded',true);
end $$;
revoke all on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) to authenticated;

-- Metadata edits are atomic and bound to the administrator who opened the editor.
create or replace function public.gosvt_platform_save_resource(p_id uuid,p_document jsonb,p_expected_user uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_tracks text[];
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user or not public.gosvt_platform_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(p_document->'study_tracks') is distinct from 'array' then raise exception 'invalid_tracks'; end if;
  select array_agg(value) into v_tracks from jsonb_array_elements_text(p_document->'study_tracks');
  if p_id is null then
    insert into public.learning_resources(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,created_by)
    values(trim(p_document->>'title'),coalesce(p_document->>'description',''),trim(p_document->>'source_url'),p_document->>'resource_kind',p_document->>'study_level',v_tracks,p_document->>'language',coalesce((p_document->>'is_published')::boolean,false),coalesce((p_document->>'position')::integer,0),auth.uid()) returning id into v_id;
  else
    update public.learning_resources set title=trim(p_document->>'title'),description=coalesce(p_document->>'description',''),source_url=trim(p_document->>'source_url'),resource_kind=p_document->>'resource_kind',study_level=p_document->>'study_level',study_tracks=v_tracks,language=p_document->>'language',is_published=coalesce((p_document->>'is_published')::boolean,false),position=coalesce((p_document->>'position')::integer,0),updated_at=now()
      where id=p_id and updated_at=(p_document->>'expected_updated_at')::timestamptz returning id into v_id;
    if not found then raise exception 'resource_updated_elsewhere'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) to authenticated;
revoke insert,update on public.learning_resources from authenticated;
revoke insert(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position) on public.learning_resources from authenticated;
revoke update(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at) on public.learning_resources from authenticated;
 then raise exception 'invalid_question'; end if;
    select array_agg(value) into v_options from jsonb_array_elements_text(q->'options');
    if exists(select 1 from unnest(v_options) opt where char_length(trim(opt)) not between 1 and 2000) or (q->>'answer') !~ '^[0-9]+$' then raise exception 'invalid_options'; end if;
    insert into public.learning_questions(assessment_id,position,prompt,options,answer,explanation,points)
      values(v_id,v_position,trim(q->>'prompt'),v_options,(q->>'answer')::integer,trim(q->>'explanation'),coalesce((q->>'points')::integer,1));
    v_position:=v_position+1;
  end loop;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_clean_answers(p_snapshot jsonb,p_answers jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare entry record; q jsonb; result jsonb:='{}';
begin
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>12000 then raise exception 'invalid_answers'; end if;
  for entry in select * from jsonb_each(p_answers) loop
    select value into q from jsonb_array_elements(p_snapshot) where value->>'id'=entry.key;
    if q is null or jsonb_typeof(entry.value) is distinct from 'number' or entry.value::text !~ '^[0-9]+$' or (entry.value::text)::integer >= jsonb_array_length(q->'options') then raise exception 'invalid_answer'; end if;
    result:=result||jsonb_build_object(entry.key,entry.value);
  end loop;
  return result;
end $$;
revoke all on function public.gosvt_platform_clean_answers(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.gosvt_platform_start_assessment(p_assessment_id uuid,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.learning_assessments%rowtype; attempt public.learning_attempts%rowtype; snapshot jsonb; total integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_assessment_id::text,0));
  select * into attempt from public.learning_attempts where student_id=auth.uid() and assessment_id=p_assessment_id and submitted_at is null;
  if not found then
    select * into a from public.learning_assessments where id=p_assessment_id and is_published for share;
    if not found or not exists(select 1 from public.student_academic_profiles p where p.student_id=auth.uid() and p.study_level=a.study_level and p.study_track=any(a.study_tracks)) then raise exception 'assessment_not_available_for_profile' using errcode='42501'; end if;
    if (select count(*) from public.learning_attempts where student_id=auth.uid() and started_at>now()-interval '1 hour')>=30 then raise exception 'too_many_attempts'; end if;
    select jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options,'answer',answer,'explanation',explanation,'points',points) order by position),sum(points) into snapshot,total from public.learning_questions where assessment_id=a.id;
    if snapshot is null or jsonb_array_length(snapshot)<3 then raise exception 'assessment_has_no_questions'; end if;
    insert into public.learning_attempts(student_id,assessment_id,title_snapshot,question_snapshot,deadline_at,max_score)
      values(auth.uid(),a.id,a.title,snapshot,now()+make_interval(mins=>a.duration_minutes),total) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'assessment_id',attempt.assessment_id,'deadline_at',attempt.deadline_at,'server_time',now(),'last_sequence',attempt.last_sequence,'answers',attempt.answers,'questions',(select jsonb_agg(value-'answer'-'explanation') from jsonb_array_elements(attempt.question_snapshot)));
end $$;
revoke all on function public.gosvt_platform_start_assessment(uuid,uuid) from public,anon;
grant execute on function public.gosvt_platform_start_assessment(uuid,uuid) to authenticated;

create or replace function public.gosvt_platform_save_answers(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is not null or now()>attempt.deadline_at then raise exception 'attempt_closed'; end if;
  clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
  if p_sequence is null or p_sequence<0 then raise exception 'invalid_sequence'; end if;
  if p_sequence<=attempt.last_sequence then return jsonb_build_object('accepted',p_sequence=attempt.last_sequence and clean=attempt.answers,'last_sequence',attempt.last_sequence); end if;
  update public.learning_attempts set answers=clean,last_sequence=p_sequence where id=attempt.id;
  return jsonb_build_object('accepted',true,'last_sequence',p_sequence);
end $$;
revoke all on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_submit_assessment(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb; q jsonb; selected integer; earned integer; total integer:=0; result jsonb:='[]';
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is null then
    if now()<=attempt.deadline_at then
      if p_sequence is null or p_sequence<attempt.last_sequence then raise exception 'attempt_updated_elsewhere'; end if;
      clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
    else
      -- Once time expires, late payloads cannot replace the answers previously saved on the server.
      clean:=attempt.answers;
    end if;
    for q in select value from jsonb_array_elements(attempt.question_snapshot) loop
      selected:=(clean->>(q->>'id'))::integer;
      earned:=case when selected=(q->>'answer')::integer then (q->>'points')::integer else 0 end;
      total:=total+earned;
      result:=result||jsonb_build_array(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',q->'options','answer',(q->>'answer')::integer,'explanation',q->>'explanation','points',(q->>'points')::integer,'selected',selected,'correct',coalesce(selected=(q->>'answer')::integer,false),'earned',earned));
    end loop;
    update public.learning_attempts set answers=clean,score=total,feedback=result,submitted_at=now(),last_sequence=greatest(last_sequence,coalesce(p_sequence,last_sequence)) where id=attempt.id returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'score',attempt.score,'maximum',attempt.max_score,'percentage',round(100.0*attempt.score/attempt.max_score),'feedback',attempt.feedback,'submitted_at',attempt.submitted_at,'server_graded',true);
end $$;
revoke all on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) to authenticated;

-- Metadata edits are atomic and bound to the administrator who opened the editor.
create or replace function public.gosvt_platform_save_resource(p_id uuid,p_document jsonb,p_expected_user uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_tracks text[];
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user or not public.gosvt_platform_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(p_document->'study_tracks') is distinct from 'array' then raise exception 'invalid_tracks'; end if;
  select array_agg(value) into v_tracks from jsonb_array_elements_text(p_document->'study_tracks');
  if p_id is null then
    insert into public.learning_resources(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,created_by)
    values(trim(p_document->>'title'),coalesce(p_document->>'description',''),trim(p_document->>'source_url'),p_document->>'resource_kind',p_document->>'study_level',v_tracks,p_document->>'language',coalesce((p_document->>'is_published')::boolean,false),coalesce((p_document->>'position')::integer,0),auth.uid()) returning id into v_id;
  else
    update public.learning_resources set title=trim(p_document->>'title'),description=coalesce(p_document->>'description',''),source_url=trim(p_document->>'source_url'),resource_kind=p_document->>'resource_kind',study_level=p_document->>'study_level',study_tracks=v_tracks,language=p_document->>'language',is_published=coalesce((p_document->>'is_published')::boolean,false),position=coalesce((p_document->>'position')::integer,0),updated_at=now()
      where id=p_id and updated_at=(p_document->>'expected_updated_at')::timestamptz returning id into v_id;
    if not found then raise exception 'resource_updated_elsewhere'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) to authenticated;
revoke insert,update on public.learning_resources from authenticated;
revoke insert(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position) on public.learning_resources from authenticated;
revoke update(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at) on public.learning_resources from authenticated;
 then raise exception 'invalid_question'; end if;
    select array_agg(value) into v_options from jsonb_array_elements_text(q->'options');
    if exists(select 1 from unnest(v_options) opt where char_length(trim(opt)) not between 1 and 2000) or (q->>'answer') !~ '^[0-9]+$' then raise exception 'invalid_options'; end if;
    insert into public.learning_questions(assessment_id,position,prompt,options,answer,explanation,points)
      values(v_id,v_position,trim(q->>'prompt'),v_options,(q->>'answer')::integer,trim(q->>'explanation'),coalesce((q->>'points')::integer,1));
    v_position:=v_position+1;
  end loop;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_assessment(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_clean_answers(p_snapshot jsonb,p_answers jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare entry record; q jsonb; result jsonb:='{}';
begin
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>12000 then raise exception 'invalid_answers'; end if;
  for entry in select * from jsonb_each(p_answers) loop
    select value into q from jsonb_array_elements(p_snapshot) where value->>'id'=entry.key;
    if q is null or jsonb_typeof(entry.value) is distinct from 'number' or entry.value::text !~ '^[0-9]+$' or (entry.value::text)::integer >= jsonb_array_length(q->'options') then raise exception 'invalid_answer'; end if;
    result:=result||jsonb_build_object(entry.key,entry.value);
  end loop;
  return result;
end $$;
revoke all on function public.gosvt_platform_clean_answers(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.gosvt_platform_start_assessment(p_assessment_id uuid,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.learning_assessments%rowtype; attempt public.learning_attempts%rowtype; snapshot jsonb; total integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_assessment_id::text,0));
  select * into attempt from public.learning_attempts where student_id=auth.uid() and assessment_id=p_assessment_id and submitted_at is null;
  if not found then
    select * into a from public.learning_assessments where id=p_assessment_id and is_published for share;
    if not found or not exists(select 1 from public.student_academic_profiles p where p.student_id=auth.uid() and p.study_level=a.study_level and p.study_track=any(a.study_tracks)) then raise exception 'assessment_not_available_for_profile' using errcode='42501'; end if;
    if (select count(*) from public.learning_attempts where student_id=auth.uid() and started_at>now()-interval '1 hour')>=30 then raise exception 'too_many_attempts'; end if;
    select jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options,'answer',answer,'explanation',explanation,'points',points) order by position),sum(points) into snapshot,total from public.learning_questions where assessment_id=a.id;
    if snapshot is null or jsonb_array_length(snapshot)<3 then raise exception 'assessment_has_no_questions'; end if;
    insert into public.learning_attempts(student_id,assessment_id,title_snapshot,question_snapshot,deadline_at,max_score)
      values(auth.uid(),a.id,a.title,snapshot,now()+make_interval(mins=>a.duration_minutes),total) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'assessment_id',attempt.assessment_id,'deadline_at',attempt.deadline_at,'server_time',now(),'last_sequence',attempt.last_sequence,'answers',attempt.answers,'questions',(select jsonb_agg(value-'answer'-'explanation') from jsonb_array_elements(attempt.question_snapshot)));
end $$;
revoke all on function public.gosvt_platform_start_assessment(uuid,uuid) from public,anon;
grant execute on function public.gosvt_platform_start_assessment(uuid,uuid) to authenticated;

create or replace function public.gosvt_platform_save_answers(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is not null or now()>attempt.deadline_at then raise exception 'attempt_closed'; end if;
  clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
  if p_sequence is null or p_sequence<0 then raise exception 'invalid_sequence'; end if;
  if p_sequence<=attempt.last_sequence then return jsonb_build_object('accepted',p_sequence=attempt.last_sequence and clean=attempt.answers,'last_sequence',attempt.last_sequence); end if;
  update public.learning_attempts set answers=clean,last_sequence=p_sequence where id=attempt.id;
  return jsonb_build_object('accepted',true,'last_sequence',p_sequence);
end $$;
revoke all on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_answers(uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.gosvt_platform_submit_assessment(p_attempt_id uuid,p_answers jsonb,p_sequence integer,p_expected_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt public.learning_attempts%rowtype; clean jsonb; q jsonb; selected integer; earned integer; total integer:=0; result jsonb:='[]';
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_student then raise exception 'authentication_changed' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role::text='student') then raise exception 'student_role_required' using errcode='42501'; end if;
  select * into attempt from public.learning_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'attempt_not_found' using errcode='42501'; end if;
  if attempt.submitted_at is null then
    if now()<=attempt.deadline_at then
      if p_sequence is null or p_sequence<attempt.last_sequence then raise exception 'attempt_updated_elsewhere'; end if;
      clean:=public.gosvt_platform_clean_answers(attempt.question_snapshot,p_answers);
    else
      -- Once time expires, late payloads cannot replace the answers previously saved on the server.
      clean:=attempt.answers;
    end if;
    for q in select value from jsonb_array_elements(attempt.question_snapshot) loop
      selected:=(clean->>(q->>'id'))::integer;
      earned:=case when selected=(q->>'answer')::integer then (q->>'points')::integer else 0 end;
      total:=total+earned;
      result:=result||jsonb_build_array(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',q->'options','answer',(q->>'answer')::integer,'explanation',q->>'explanation','points',(q->>'points')::integer,'selected',selected,'correct',coalesce(selected=(q->>'answer')::integer,false),'earned',earned));
    end loop;
    update public.learning_attempts set answers=clean,score=total,feedback=result,submitted_at=now(),last_sequence=greatest(last_sequence,coalesce(p_sequence,last_sequence)) where id=attempt.id returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'title',attempt.title_snapshot,'score',attempt.score,'maximum',attempt.max_score,'percentage',round(100.0*attempt.score/attempt.max_score),'feedback',attempt.feedback,'submitted_at',attempt.submitted_at,'server_graded',true);
end $$;
revoke all on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.gosvt_platform_submit_assessment(uuid,jsonb,integer,uuid) to authenticated;

-- Metadata edits are atomic and bound to the administrator who opened the editor.
create or replace function public.gosvt_platform_save_resource(p_id uuid,p_document jsonb,p_expected_user uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_tracks text[];
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user or not public.gosvt_platform_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(p_document->'study_tracks') is distinct from 'array' then raise exception 'invalid_tracks'; end if;
  select array_agg(value) into v_tracks from jsonb_array_elements_text(p_document->'study_tracks');
  if p_id is null then
    insert into public.learning_resources(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,created_by)
    values(trim(p_document->>'title'),coalesce(p_document->>'description',''),trim(p_document->>'source_url'),p_document->>'resource_kind',p_document->>'study_level',v_tracks,p_document->>'language',coalesce((p_document->>'is_published')::boolean,false),coalesce((p_document->>'position')::integer,0),auth.uid()) returning id into v_id;
  else
    update public.learning_resources set title=trim(p_document->>'title'),description=coalesce(p_document->>'description',''),source_url=trim(p_document->>'source_url'),resource_kind=p_document->>'resource_kind',study_level=p_document->>'study_level',study_tracks=v_tracks,language=p_document->>'language',is_published=coalesce((p_document->>'is_published')::boolean,false),position=coalesce((p_document->>'position')::integer,0),updated_at=now()
      where id=p_id and updated_at=(p_document->>'expected_updated_at')::timestamptz returning id into v_id;
    if not found then raise exception 'resource_updated_elsewhere'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) from public,anon;
grant execute on function public.gosvt_platform_save_resource(uuid,jsonb,uuid) to authenticated;
revoke insert,update on public.learning_resources from authenticated;
revoke insert(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position) on public.learning_resources from authenticated;
revoke update(title,description,source_url,resource_kind,study_level,study_tracks,language,is_published,position,updated_at) on public.learning_resources from authenticated;
