-- SYNTHETIC TEST FIXTURE ONLY. This is NOT the missing production baseline.
create schema auth;
create role anon;
create role authenticated;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth, public to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.profiles(id uuid primary key references auth.users(id), role text not null);
grant select on public.profiles to authenticated;
create table public.private_student_lessons(id uuid primary key, title text, is_published boolean not null default true);
grant select on public.private_student_lessons to authenticated;
grant select on public.private_student_lessons to authenticated;
create table public.student_notes(student_id uuid references auth.users(id) on delete cascade, content_key text, note text, updated_at timestamptz not null default now(), primary key(student_id,content_key));
create table public.student_study_plan(student_id uuid references auth.users(id) on delete cascade, item_key text, title text, updated_at timestamptz not null default now(), primary key(student_id,item_key));
alter table public.student_notes enable row level security;
alter table public.student_study_plan enable row level security;
create policy notes_owner_all on public.student_notes for all to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid());
create policy plans_owner_all on public.student_study_plan for all to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid());
grant select,insert,update,delete on public.student_notes, public.student_study_plan to authenticated;
create table public.teacher_classes(id uuid primary key, teacher_id uuid references auth.users(id));
create table public.teacher_questions(id uuid primary key, class_id uuid references public.teacher_classes(id), student_id uuid references auth.users(id), status text default 'new', updated_at timestamptz default now());
create table public.teacher_question_messages(id uuid primary key default gen_random_uuid(), question_id uuid references public.teacher_questions(id), sender_id uuid references auth.users(id), body text, created_at timestamptz default now());
create function public.gosvt_can_manage_class(p_class_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.teacher_classes where id=p_class_id and teacher_id=auth.uid());
$$;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
insert into public.profiles values ('00000000-0000-0000-0000-000000000001','student'),('00000000-0000-0000-0000-000000000002','student'),('00000000-0000-0000-0000-000000000003','teacher');
insert into public.private_student_lessons(id,title,is_published) values ('10000000-0000-0000-0000-000000000001','Lesson one',true),('10000000-0000-0000-0000-000000000002','Lesson two',true),('10000000-0000-0000-0000-000000000003','Unpublished lesson',false);
insert into public.teacher_classes values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
insert into public.teacher_questions(id,class_id,student_id) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
