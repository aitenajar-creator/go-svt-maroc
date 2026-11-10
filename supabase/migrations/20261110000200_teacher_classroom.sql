-- GO SVT Maroc: teacher classrooms, private student questions and assignments foundation.
-- Additive only: preserves existing student records and role-protection triggers.

create or replace function public.gosvt_is_teacher_or_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher', 'admin')
  );
$$;

create or replace function public.gosvt_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create table if not exists public.teacher_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  study_level text not null check (study_level in ('TC', '1BAC', '2BAC')),
  study_track text not null check (study_track in ('TCS','TCL','1BACSE','1BACSM','1BACL','2BACSVT','2BACSP','2BACSM')),
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_class_students (
  class_id uuid not null references public.teacher_classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index if not exists teacher_classes_teacher_idx on public.teacher_classes(teacher_id, created_at desc);
create index if not exists teacher_class_students_student_idx on public.teacher_class_students(student_id, joined_at desc);

create or replace function public.gosvt_can_manage_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_classes c
    where c.id = p_class_id
      and (c.teacher_id = (select auth.uid()) or public.gosvt_is_admin())
  );
$$;

create or replace function public.gosvt_can_access_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.gosvt_can_manage_class(p_class_id)
    or exists (
      select 1 from public.teacher_class_students cs
      where cs.class_id = p_class_id and cs.student_id = (select auth.uid())
    );
$$;

create table if not exists public.teacher_questions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.teacher_classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 2 and 180),
  body text not null check (char_length(trim(body)) between 3 and 8000),
  status text not null default 'new' check (status in ('new','in_progress','answered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists teacher_questions_class_date_idx on public.teacher_questions(class_id, created_at desc);
create index if not exists teacher_questions_student_date_idx on public.teacher_questions(student_id, created_at desc);

create table if not exists public.teacher_question_messages (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.teacher_questions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 8000),
  created_at timestamptz not null default now()
);
create index if not exists teacher_question_messages_thread_idx on public.teacher_question_messages(question_id, created_at);

create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.teacher_classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 2 and 180),
  instructions text not null default '' check (char_length(instructions) <= 8000),
  resource_url text,
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists teacher_assignments_class_date_idx on public.teacher_assignments(class_id, created_at desc);

create table if not exists public.teacher_assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.teacher_assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (char_length(trim(answer)) between 1 and 12000),
  score numeric(5,2) check (score is null or score between 0 and 20),
  feedback text check (feedback is null or char_length(feedback) <= 5000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (assignment_id, student_id)
);

create table if not exists public.teacher_announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.teacher_classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 2 and 180),
  body text not null check (char_length(trim(body)) between 1 and 8000),
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_review_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.teacher_classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text not null default '' check (char_length(description) <= 5000),
  starts_at timestamptz not null,
  meeting_url text,
  created_at timestamptz not null default now()
);

-- Roster RPC exposes only basic identity and aggregate learning indicators to the assigned teacher.
create or replace function public.gosvt_teacher_class_roster(p_class_id uuid)
returns table (
  student_id uuid,
  display_name text,
  study_level text,
  study_track text,
  joined_at timestamptz,
  completed_lessons bigint,
  quiz_attempts bigint,
  average_score numeric
)
language plpgsql stable security definer
set search_path = public
as $$
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
         coalesce(pr.completed_lessons, 0)::bigint,
         coalesce(qa.attempt_count, 0)::bigint,
         qa.average_score
  from public.teacher_class_students cs
  join public.profiles p on p.id = cs.student_id
  left join auth.users u on u.id = p.id
  left join lateral (
    select count(*) filter (where sp.completed = true) as completed_lessons
    from public.student_progress sp
    where sp.student_id = p.id and sp.content_type = 'lesson'
  ) pr on true
  left join lateral (
    select count(*) as attempt_count, round(avg(sqa.percentage), 1) as average_score
    from public.student_quiz_attempts sqa
    where sqa.student_id = p.id
  ) qa on true
  where cs.class_id = p_class_id
  order by cs.joined_at desc;
end;
$$;

-- Students join only as their authenticated account; the code is never exposed in student list queries.
create or replace function public.gosvt_join_teacher_class(p_join_code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_class_id uuid;
  v_level text;
  v_track text;
begin
  if v_student is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_student and p.role = 'student') then
    raise exception 'student_account_required';
  end if;
  select c.id, c.study_level, c.study_track
    into v_class_id, v_level, v_track
  from public.teacher_classes c
  where c.join_code = upper(trim(p_join_code));
  if v_class_id is null then raise exception 'invalid_join_code'; end if;
  if not exists (
    select 1 from auth.users u
    where u.id = v_student
      and coalesce(u.raw_user_meta_data->>'study_level','') = v_level
      and coalesce(u.raw_user_meta_data->>'study_track','') = v_track
  ) then raise exception 'class_track_mismatch'; end if;
  insert into public.teacher_class_students(class_id, student_id)
  values (v_class_id, v_student)
  on conflict (class_id, student_id) do nothing;
  return v_class_id;
end;
$$;

alter table public.teacher_classes enable row level security;
alter table public.teacher_class_students enable row level security;
alter table public.teacher_questions enable row level security;
alter table public.teacher_question_messages enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.teacher_assignment_submissions enable row level security;
alter table public.teacher_announcements enable row level security;
alter table public.teacher_review_sessions enable row level security;

drop policy if exists teacher_classes_read_access on public.teacher_classes;
create policy teacher_classes_read_access on public.teacher_classes
for select to authenticated using (public.gosvt_can_access_class(id));
drop policy if exists teacher_classes_insert_owner on public.teacher_classes;
create policy teacher_classes_insert_owner on public.teacher_classes
for insert to authenticated with check (
  teacher_id = (select auth.uid()) and public.gosvt_is_teacher_or_admin()
);
drop policy if exists teacher_classes_update_owner on public.teacher_classes;
create policy teacher_classes_update_owner on public.teacher_classes
for update to authenticated using (public.gosvt_can_manage_class(id))
with check (public.gosvt_can_manage_class(id));
drop policy if exists teacher_classes_delete_owner on public.teacher_classes;
create policy teacher_classes_delete_owner on public.teacher_classes
for delete to authenticated using (public.gosvt_can_manage_class(id));

drop policy if exists teacher_class_students_read_related on public.teacher_class_students;
create policy teacher_class_students_read_related on public.teacher_class_students
for select to authenticated using (
  student_id = (select auth.uid()) or public.gosvt_can_manage_class(class_id)
);
drop policy if exists teacher_class_students_remove_teacher on public.teacher_class_students;
create policy teacher_class_students_remove_teacher on public.teacher_class_students
for delete to authenticated using (public.gosvt_can_manage_class(class_id));

drop policy if exists teacher_questions_read_related on public.teacher_questions;
create policy teacher_questions_read_related on public.teacher_questions
for select to authenticated using (
  student_id = (select auth.uid()) or public.gosvt_can_manage_class(class_id)
);
drop policy if exists teacher_questions_insert_student on public.teacher_questions;
create policy teacher_questions_insert_student on public.teacher_questions
for insert to authenticated with check (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.teacher_class_students cs
    where cs.class_id = teacher_questions.class_id and cs.student_id = (select auth.uid())
  )
);
drop policy if exists teacher_questions_update_teacher on public.teacher_questions;
create policy teacher_questions_update_teacher on public.teacher_questions
for update to authenticated using (public.gosvt_can_manage_class(class_id))
with check (public.gosvt_can_manage_class(class_id));

drop policy if exists teacher_question_messages_read_related on public.teacher_question_messages;
create policy teacher_question_messages_read_related on public.teacher_question_messages
for select to authenticated using (
  exists (
    select 1 from public.teacher_questions q
    where q.id = question_id
      and (q.student_id = (select auth.uid()) or public.gosvt_can_manage_class(q.class_id))
  )
);
drop policy if exists teacher_question_messages_insert_related on public.teacher_question_messages;
create policy teacher_question_messages_insert_related on public.teacher_question_messages
for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.teacher_questions q
    where q.id = question_id
      and (q.student_id = (select auth.uid()) or public.gosvt_can_manage_class(q.class_id))
  )
);

drop policy if exists teacher_assignments_read_class on public.teacher_assignments;
create policy teacher_assignments_read_class on public.teacher_assignments
for select to authenticated using (public.gosvt_can_access_class(class_id));
drop policy if exists teacher_assignments_manage_class on public.teacher_assignments;
create policy teacher_assignments_manage_class on public.teacher_assignments
for all to authenticated using (public.gosvt_can_manage_class(class_id))
with check (public.gosvt_can_manage_class(class_id) and created_by = (select auth.uid()));

drop policy if exists teacher_assignment_submissions_read_related on public.teacher_assignment_submissions;
create policy teacher_assignment_submissions_read_related on public.teacher_assignment_submissions
for select to authenticated using (
  student_id = (select auth.uid()) or exists (
    select 1 from public.teacher_assignments a
    where a.id = assignment_id and public.gosvt_can_manage_class(a.class_id)
  )
);
drop policy if exists teacher_assignment_submissions_insert_student on public.teacher_assignment_submissions;
create policy teacher_assignment_submissions_insert_student on public.teacher_assignment_submissions
for insert to authenticated with check (
  student_id = (select auth.uid()) and exists (
    select 1 from public.teacher_assignments a
    join public.teacher_class_students cs on cs.class_id = a.class_id
    where a.id = assignment_id and cs.student_id = (select auth.uid())
  )
);
drop policy if exists teacher_assignment_submissions_update_teacher on public.teacher_assignment_submissions;
create policy teacher_assignment_submissions_update_teacher on public.teacher_assignment_submissions
for update to authenticated using (exists (
  select 1 from public.teacher_assignments a
  where a.id = assignment_id and public.gosvt_can_manage_class(a.class_id)
)) with check (exists (
  select 1 from public.teacher_assignments a
  where a.id = assignment_id and public.gosvt_can_manage_class(a.class_id)
));

drop policy if exists teacher_announcements_read_class on public.teacher_announcements;
create policy teacher_announcements_read_class on public.teacher_announcements
for select to authenticated using (public.gosvt_can_access_class(class_id));
drop policy if exists teacher_announcements_insert_teacher on public.teacher_announcements;
create policy teacher_announcements_insert_teacher on public.teacher_announcements
for insert to authenticated with check (
  public.gosvt_can_manage_class(class_id) and created_by = (select auth.uid())
);
drop policy if exists teacher_announcements_delete_teacher on public.teacher_announcements;
create policy teacher_announcements_delete_teacher on public.teacher_announcements
for delete to authenticated using (public.gosvt_can_manage_class(class_id));

drop policy if exists teacher_review_sessions_read_class on public.teacher_review_sessions;
create policy teacher_review_sessions_read_class on public.teacher_review_sessions
for select to authenticated using (public.gosvt_can_access_class(class_id));
drop policy if exists teacher_review_sessions_manage_teacher on public.teacher_review_sessions;
create policy teacher_review_sessions_manage_teacher on public.teacher_review_sessions
for all to authenticated using (public.gosvt_can_manage_class(class_id))
with check (public.gosvt_can_manage_class(class_id) and created_by = (select auth.uid()));

revoke all on function public.gosvt_teacher_class_roster(uuid) from public;
revoke all on function public.gosvt_join_teacher_class(text) from public;
grant execute on function public.gosvt_teacher_class_roster(uuid) to authenticated;
grant execute on function public.gosvt_join_teacher_class(text) to authenticated;
grant execute on function public.gosvt_is_teacher_or_admin() to authenticated;
grant execute on function public.gosvt_is_admin() to authenticated;
grant execute on function public.gosvt_can_manage_class(uuid) to authenticated;
grant execute on function public.gosvt_can_access_class(uuid) to authenticated;

grant select, insert, update, delete on public.teacher_classes to authenticated;
grant select, delete on public.teacher_class_students to authenticated;
grant select, insert, update on public.teacher_questions to authenticated;
grant select, insert on public.teacher_question_messages to authenticated;
grant select, insert, update, delete on public.teacher_assignments to authenticated;
grant select, insert, update on public.teacher_assignment_submissions to authenticated;
grant select, insert, delete on public.teacher_announcements to authenticated;
grant select, insert, update, delete on public.teacher_review_sessions to authenticated;
