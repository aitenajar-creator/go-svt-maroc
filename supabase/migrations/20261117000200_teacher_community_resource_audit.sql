-- Admin-only immutable audit trail for teacher-community resource operations.
-- The actor is always taken from the verified Supabase request context (auth.uid()).
-- Apply only to the dedicated teacher-community Supabase project.

create table if not exists public.teacher_community_resource_activity (
  id bigint generated always as identity primary key,
  resource_id uuid not null,
  resource_title text not null,
  owner_id uuid not null,
  actor_id uuid,
  action text not null check (action in (
    'uploaded','updated','hidden','restored','shared','unshared','deleted'
  )),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists teacher_community_resource_activity_created_idx
  on public.teacher_community_resource_activity(created_at desc, id desc);
create index if not exists teacher_community_resource_activity_resource_idx
  on public.teacher_community_resource_activity(resource_id, created_at desc);

alter table public.teacher_community_resource_activity enable row level security;
revoke all on table public.teacher_community_resource_activity from public, anon, authenticated;
grant select on table public.teacher_community_resource_activity to authenticated;

drop policy if exists teacher_community_resource_activity_admin_read
  on public.teacher_community_resource_activity;
create policy teacher_community_resource_activity_admin_read
on public.teacher_community_resource_activity
for select to authenticated
using (public.gosvt_teacher_community_is_admin());

create or replace function public.gosvt_teacher_community_log_resource_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor uuid := auth.uid();
  v_details jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.teacher_community_resource_activity
      (resource_id, resource_title, owner_id, actor_id, action, details)
    values
      (new.id, new.title, new.owner_id, v_actor, 'uploaded',
       jsonb_build_object('category', new.category, 'is_shared', new.is_shared, 'status', new.status));
    return new;
  elsif tg_op = 'UPDATE' then
    if old.title is distinct from new.title then
      v_details := v_details || jsonb_build_object('title', jsonb_build_object('before', old.title, 'after', new.title));
    end if;
    if old.description is distinct from new.description then
      v_details := v_details || jsonb_build_object('description', jsonb_build_object('before', old.description, 'after', new.description));
    end if;
    if old.category is distinct from new.category then
      v_details := v_details || jsonb_build_object('category', jsonb_build_object('before', old.category, 'after', new.category));
    end if;
    if v_details <> '{}'::jsonb then
      insert into public.teacher_community_resource_activity
        (resource_id, resource_title, owner_id, actor_id, action, details)
      values (new.id, new.title, new.owner_id, v_actor, 'updated', v_details);
    end if;

    if old.status is distinct from new.status then
      insert into public.teacher_community_resource_activity
        (resource_id, resource_title, owner_id, actor_id, action, details)
      values (
        new.id, new.title, new.owner_id, v_actor,
        case when new.status = 'hidden' then 'hidden' else 'restored' end,
        jsonb_build_object('status', jsonb_build_object('before', old.status, 'after', new.status))
      );
    end if;

    if old.is_shared is distinct from new.is_shared then
      insert into public.teacher_community_resource_activity
        (resource_id, resource_title, owner_id, actor_id, action, details)
      values (
        new.id, new.title, new.owner_id, v_actor,
        case when new.is_shared then 'shared' else 'unshared' end,
        jsonb_build_object('is_shared', jsonb_build_object('before', old.is_shared, 'after', new.is_shared))
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.teacher_community_resource_activity
      (resource_id, resource_title, owner_id, actor_id, action, details)
    values
      (old.id, old.title, old.owner_id, v_actor, 'deleted',
       jsonb_build_object('category', old.category, 'is_shared', old.is_shared, 'status', old.status));
    return old;
  end if;
  return null;
end;
$function$;

revoke all on function public.gosvt_teacher_community_log_resource_activity() from public, anon, authenticated;

drop trigger if exists teacher_community_resource_activity_audit
  on public.teacher_community_resources;
create trigger teacher_community_resource_activity_audit
after insert or update or delete on public.teacher_community_resources
for each row execute function public.gosvt_teacher_community_log_resource_activity();
