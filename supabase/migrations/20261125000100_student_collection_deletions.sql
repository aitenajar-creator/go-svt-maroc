-- MAIN project only. Durable deletion markers prevent stale devices restoring deleted items.
-- Prerequisite: the existing student_notes and student_study_plan baseline tables.
create table if not exists public.student_collection_tombstones (
  student_id uuid not null references auth.users(id) on delete cascade,
  collection text not null check (collection in ('notes', 'studyPlan')),
  item_key text not null check (char_length(item_key) between 1 and 500),
  deleted_at timestamptz not null default now(),
  primary key (student_id, collection, item_key)
);
alter table public.student_collection_tombstones enable row level security;
revoke all on public.student_collection_tombstones from public, anon, authenticated;
grant select on public.student_collection_tombstones to authenticated;
create policy student_collection_tombstones_read_own
  on public.student_collection_tombstones for select to authenticated
  using (student_id = (select auth.uid()));

-- All writes for an item share a transaction lock. Old clients' direct deletes
-- also record a tombstone; stale inserts are skipped without losing other rows in a batch.
create or replace function public.gosvt_guard_student_collection_item()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  v_collection text := case tg_table_name when 'student_notes' then 'notes' else 'studyPlan' end;
  v_student uuid;
  v_key text;
begin
  if tg_op = 'DELETE' then
    v_student := old.student_id;
    v_key := case tg_table_name when 'student_notes' then to_jsonb(old)->>'content_key' else to_jsonb(old)->>'item_key' end;
  else
    v_student := new.student_id;
    v_key := case tg_table_name when 'student_notes' then to_jsonb(new)->>'content_key' else to_jsonb(new)->>'item_key' end;
  end if;
  -- Cascading account deletion must not recreate a row referencing the deleted user.
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = v_student) then return old; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_student::text || ':' || v_collection || ':' || v_key, 0));
  if tg_op = 'DELETE' then
    insert into public.student_collection_tombstones(student_id, collection, item_key)
    values (v_student, v_collection, v_key) on conflict do nothing;
    return old;
  end if;
  if exists (select 1 from public.student_collection_tombstones
             where student_id = v_student and collection = v_collection and item_key = v_key) then
    return null;
  end if;
  -- A stale device must not replace a newer note or planner entry.
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then return null; end if;
  return new;
end;
$function$;
revoke all on function public.gosvt_guard_student_collection_item() from public, anon, authenticated;

create trigger gosvt_notes_deletion_guard
  before insert or update or delete on public.student_notes
  for each row execute function public.gosvt_guard_student_collection_item();
create trigger gosvt_study_plan_deletion_guard
  before insert or update or delete on public.student_study_plan
  for each row execute function public.gosvt_guard_student_collection_item();

-- Mark even an item that has not reached the cloud yet. The owner comes from
-- auth.uid(); the expected identity only guards requests delayed across account switches.
create or replace function public.gosvt_delete_student_collection_item(p_collection text, p_item_key text, p_expected_student_id uuid)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare v_student uuid := auth.uid();
begin
  if v_student is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_expected_student_id is distinct from v_student then raise exception 'session_changed' using errcode = '42501'; end if;
  if p_collection is null or p_collection not in ('notes', 'studyPlan')
     or p_item_key is null or char_length(p_item_key) not between 1 and 500 then
    raise exception 'invalid_collection_item' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_student::text || ':' || p_collection || ':' || p_item_key, 0));
  insert into public.student_collection_tombstones(student_id, collection, item_key)
  values (v_student, p_collection, p_item_key) on conflict do nothing;
  if p_collection = 'notes' then
    delete from public.student_notes where student_id = v_student and content_key = p_item_key;
  else
    delete from public.student_study_plan where student_id = v_student and item_key = p_item_key;
  end if;
  return true;
end;
$function$;
revoke all on function public.gosvt_delete_student_collection_item(text, text, uuid) from public, anon;
grant execute on function public.gosvt_delete_student_collection_item(text, text, uuid) to authenticated;
