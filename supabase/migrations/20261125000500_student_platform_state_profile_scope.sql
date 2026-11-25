-- Go SVT Maroc — isolate Masahati cloud state by authenticated account AND learner profile.
-- Additive compatibility migration: safe for a fresh table and upgrades the earlier
-- student_id-only shape without touching existing student progress/notes/favorites tables.

create table if not exists public.student_platform_state (
  student_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null default 'default',
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint student_platform_state_size check (pg_column_size(state) <= 1048576),
  constraint student_platform_state_state_object check (jsonb_typeof(state) = 'object')
);

alter table public.student_platform_state
  add column if not exists profile_id text not null default 'default';

alter table public.student_platform_state
  add column if not exists state jsonb not null default '{}'::jsonb;

alter table public.student_platform_state
  add column if not exists updated_at timestamptz not null default now();

alter table public.student_platform_state
  alter column profile_id drop default;

do $$
declare
  pk_name text;
begin
  select conname into pk_name
  from pg_constraint
  where conrelid = 'public.student_platform_state'::regclass
    and contype = 'p'
  limit 1;

  if pk_name is not null then
    execute format('alter table public.student_platform_state drop constraint %I', pk_name);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_platform_state'::regclass
      and contype = 'p'
  ) then
    alter table public.student_platform_state
      add constraint student_platform_state_pkey primary key (student_id, profile_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_platform_state'::regclass
      and conname = 'student_platform_state_profile_id_check'
  ) then
    alter table public.student_platform_state
      add constraint student_platform_state_profile_id_check
      check (length(profile_id) between 1 and 128);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_platform_state'::regclass
      and conname = 'student_platform_state_state_object'
  ) then
    alter table public.student_platform_state
      add constraint student_platform_state_state_object
      check (jsonb_typeof(state) = 'object');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_platform_state'::regclass
      and conname = 'student_platform_state_size'
  ) then
    alter table public.student_platform_state
      add constraint student_platform_state_size
      check (pg_column_size(state) <= 1048576);
  end if;
end $$;

alter table public.student_platform_state enable row level security;

drop policy if exists student_platform_state_select_own on public.student_platform_state;
create policy student_platform_state_select_own on public.student_platform_state
  for select to authenticated using (student_id = (select auth.uid()));

drop policy if exists student_platform_state_insert_own on public.student_platform_state;
create policy student_platform_state_insert_own on public.student_platform_state
  for insert to authenticated with check (student_id = (select auth.uid()));

drop policy if exists student_platform_state_update_own on public.student_platform_state;
create policy student_platform_state_update_own on public.student_platform_state
  for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));

drop policy if exists student_platform_state_delete_own on public.student_platform_state;
create policy student_platform_state_delete_own on public.student_platform_state
  for delete to authenticated using (student_id = (select auth.uid()));

revoke all on public.student_platform_state from anon, authenticated;
grant select, insert, update, delete on public.student_platform_state to authenticated;
