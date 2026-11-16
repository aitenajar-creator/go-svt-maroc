-- Private per-student goals and learning streak state.
create table if not exists public.student_learning_state (
  student_id uuid primary key references auth.users(id) on delete cascade,
  goals jsonb not null default '[]'::jsonb,
  streak jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint student_learning_state_goals_array check (jsonb_typeof(goals) = 'array'),
  constraint student_learning_state_streak_object check (jsonb_typeof(streak) = 'object')
);
alter table public.student_learning_state enable row level security;
revoke all on table public.student_learning_state from anon, authenticated;
grant select, insert, update on table public.student_learning_state to authenticated;
drop policy if exists student_learning_state_owner_all on public.student_learning_state;
create policy student_learning_state_owner_all
  on public.student_learning_state
  for all
  to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);
