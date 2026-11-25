-- MAIN project only. Explicit, timestamp-ordered recreation after a deletion.
-- A stale device carries the original createdAt (at or before deleted_at) and is rejected.
-- A genuinely new item with a later createdAt may clear only its own tombstone.
create or replace function public.gosvt_upsert_student_collection_item(
  p_collection text,
  p_item_key text,
  p_expected_student_id uuid,
  p_item jsonb
) returns boolean
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  v_student uuid := auth.uid();
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_deleted_at timestamptz;
begin
  if v_student is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_expected_student_id is distinct from v_student then
    raise exception 'session_changed' using errcode = '42501';
  end if;
  if p_collection is null or p_collection not in ('notes', 'studyPlan')
     or p_item_key is null or char_length(p_item_key) not between 1 and 500
     or p_item is null or jsonb_typeof(p_item) <> 'object' then
    raise exception 'invalid_collection_item' using errcode = '22023';
  end if;
  if p_collection = 'notes' and coalesce(p_item->>'id','') <> p_item_key then
    raise exception 'collection_item_key_mismatch' using errcode = '22023';
  end if;
  if p_collection = 'studyPlan' and coalesce(p_item->>'id','') <> p_item_key then
    raise exception 'collection_item_key_mismatch' using errcode = '22023';
  end if;
  begin
    v_created_at := to_timestamp((p_item->>'createdAt')::double precision / 1000.0);
    v_updated_at := to_timestamp((p_item->>'updatedAt')::double precision / 1000.0);
  exception when others then
    raise exception 'invalid_collection_item_timestamp' using errcode = '22023';
  end;
  if v_created_at is null or v_updated_at is null or v_updated_at < v_created_at then
    raise exception 'invalid_collection_item_timestamp' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_student::text || ':' || p_collection || ':' || p_item_key, 0));
  select deleted_at into v_deleted_at
    from public.student_collection_tombstones
    where student_id = v_student and collection = p_collection and item_key = p_item_key
    for update;
  if v_deleted_at is not null then
    if v_created_at <= v_deleted_at then
      return false;
    end if;
    delete from public.student_collection_tombstones
      where student_id = v_student and collection = p_collection and item_key = p_item_key;
  end if;

  if p_collection = 'notes' then
    if char_length(p_item::text) > 10000 then
      raise exception 'note_too_large' using errcode = '22023';
    end if;
    insert into public.student_notes(student_id, content_key, note, updated_at)
    values (v_student, p_item_key, p_item::text, v_updated_at)
    on conflict (student_id, content_key) do update
      set note = excluded.note, updated_at = excluded.updated_at
      where excluded.updated_at >= public.student_notes.updated_at;
  else
    if coalesce(p_item->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'invalid_study_plan_date' using errcode = '22023';
    end if;
    insert into public.student_study_plan(
      student_id, item_key, title, scheduled_date, duration_minutes, completed, created_at, updated_at
    ) values (
      v_student, p_item_key, left(coalesce(p_item->>'title',''),120),
      (p_item->>'date')::date,
      least(600, greatest(5, coalesce((p_item->>'duration')::integer,30))),
      coalesce((p_item->>'completed')::boolean,false), v_created_at, v_updated_at
    )
    on conflict (student_id, item_key) do update set
      title = excluded.title, scheduled_date = excluded.scheduled_date,
      duration_minutes = excluded.duration_minutes, completed = excluded.completed,
      updated_at = excluded.updated_at
    where excluded.updated_at >= public.student_study_plan.updated_at;
  end if;
  return true;
end;
$function$;
revoke all on function public.gosvt_upsert_student_collection_item(text,text,uuid,jsonb) from public, anon;
grant execute on function public.gosvt_upsert_student_collection_item(text,text,uuid,jsonb) to authenticated;
 then
      raise exception 'invalid_study_plan_date' using errcode = '22023';
    end if;
    insert into public.student_study_plan(
      student_id, item_key, title, scheduled_date, duration_minutes, completed, created_at, updated_at
    ) values (
      v_student, p_item_key, left(coalesce(p_item->>'title',''),120),
      (p_item->>'date')::date,
      least(600, greatest(5, coalesce((p_item->>'duration')::integer,30))),
      coalesce((p_item->>'completed')::boolean,false), v_created_at, v_updated_at
    )
    on conflict (student_id, item_key) do update set
      title = excluded.title, scheduled_date = excluded.scheduled_date,
      duration_minutes = excluded.duration_minutes, completed = excluded.completed,
      updated_at = excluded.updated_at
    where excluded.updated_at >= public.student_study_plan.updated_at;
  end if;
  return true;
end;
$function$;
revoke all on function public.gosvt_upsert_student_collection_item(text,text,uuid,jsonb) from public, anon;
grant execute on function public.gosvt_upsert_student_collection_item(text,text,uuid,jsonb) to authenticated;
