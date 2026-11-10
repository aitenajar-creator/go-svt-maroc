-- GO SVT Maroc: private individual support plans for enrolled students.
create table if not exists public.teacher_student_support_plans (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.teacher_classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  actions text not null check (char_length(btrim(actions)) between 3 and 5000),
  success_criteria text not null default '' check (char_length(success_criteria) <= 500),
  due_at date,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_student_support_plans_enrollment_fk
    foreign key (class_id, student_id)
    references public.teacher_class_students(class_id, student_id)
    on delete cascade
);

create index if not exists teacher_student_support_plans_class_student_created_idx
  on public.teacher_student_support_plans (class_id, student_id, created_at desc);

drop trigger if exists teacher_student_support_plans_touch_updated_at
  on public.teacher_student_support_plans;
create trigger teacher_student_support_plans_touch_updated_at
  before update on public.teacher_student_support_plans
  for each row execute function public.set_updated_at();

alter table public.teacher_student_support_plans enable row level security;

drop policy if exists teacher_support_plans_select on public.teacher_student_support_plans;
create policy teacher_support_plans_select
  on public.teacher_student_support_plans for select to authenticated
  using (public.gosvt_can_manage_class(class_id));

drop policy if exists teacher_support_plans_insert on public.teacher_student_support_plans;
create policy teacher_support_plans_insert
  on public.teacher_student_support_plans for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and public.gosvt_can_manage_class(class_id)
    and exists (
      select 1 from public.teacher_class_students s
      where s.class_id = teacher_student_support_plans.class_id
        and s.student_id = teacher_student_support_plans.student_id
    )
  );

drop policy if exists teacher_support_plans_update on public.teacher_student_support_plans;
create policy teacher_support_plans_update
  on public.teacher_student_support_plans for update to authenticated
  using (public.gosvt_can_manage_class(class_id))
  with check (
    public.gosvt_can_manage_class(class_id)
    and exists (
      select 1 from public.teacher_class_students s
      where s.class_id = teacher_student_support_plans.class_id
        and s.student_id = teacher_student_support_plans.student_id
    )
  );

drop policy if exists teacher_support_plans_delete on public.teacher_student_support_plans;
create policy teacher_support_plans_delete
  on public.teacher_student_support_plans for delete to authenticated
  using (public.gosvt_can_manage_class(class_id));

grant select, insert, update, delete on public.teacher_student_support_plans to authenticated;
