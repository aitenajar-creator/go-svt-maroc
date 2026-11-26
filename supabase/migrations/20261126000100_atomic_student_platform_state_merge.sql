-- Merge independent Masahati edits atomically so concurrent devices do not replace
-- each other's top-level collections. Conflicts on the same leaf use last-writer-wins.
create or replace function public.gosvt_jsonb_deep_merge(p_left jsonb, p_right jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb;
  v_key text;
  v_value jsonb;
  v_left_reset bigint := 0;
  v_right_reset bigint := 0;
  v_right_updated bigint := 0;
begin
  if jsonb_typeof(p_left) <> 'object' or jsonb_typeof(p_right) <> 'object' then
    return p_right;
  end if;

  if coalesce(p_left ->> '_resetAt', '') ~ '^[0-9]{1,16}
  for v_key, v_value in select key, value from jsonb_each(p_right)
  loop
    if v_result ? v_key then
      v_result := jsonb_set(
        v_result,
        array[v_key],
        public.gosvt_jsonb_deep_merge(v_result -> v_key, v_value),
        true
      );
    else
      v_result := jsonb_set(v_result, array[v_key], v_value, true);
    end if;
  end loop;
  return v_result;
end;
$$;

revoke all on function public.gosvt_jsonb_deep_merge(jsonb,jsonb) from public, anon, authenticated;

create or replace function public.gosvt_merge_student_platform_state(
  p_student_id uuid,
  p_profile_id text,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_merged jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_student_id then
    raise exception 'session_changed' using errcode = '42501';
  end if;
  if p_profile_id is null or length(p_profile_id) not between 1 and 128 then
    raise exception 'invalid_profile_id' using errcode = '22023';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  if pg_column_size(p_state) > 1048576 then
    raise exception 'state_too_large' using errcode = '22023';
  end if;

  -- Create the row if absent; ON CONFLICT serializes simultaneous first writes.
  insert into public.student_platform_state(student_id, profile_id, state, updated_at)
  values (p_student_id, p_profile_id, '{}'::jsonb, now())
  on conflict (student_id, profile_id) do nothing;

  -- Lock the account/profile row and merge against the latest committed state.
  select state into v_existing
  from public.student_platform_state
  where student_id = p_student_id and profile_id = p_profile_id
  for update;

  v_merged := public.gosvt_jsonb_deep_merge(v_existing, p_state);

  update public.student_platform_state
  set state = v_merged, updated_at = now()
  where student_id = p_student_id and profile_id = p_profile_id;

  return v_merged;
end;
$$;

revoke all on function public.gosvt_merge_student_platform_state(uuid,text,jsonb) from public, anon;
grant execute on function public.gosvt_merge_student_platform_state(uuid,text,jsonb) to authenticated;
 then
    v_left_reset := (p_left ->> '_resetAt')::bigint;
  end if;
  if coalesce(p_right ->> '_resetAt', '') ~ '^[0-9]{1,16}
  for v_key, v_value in select key, value from jsonb_each(p_right)
  loop
    if v_result ? v_key then
      v_result := jsonb_set(
        v_result,
        array[v_key],
        public.gosvt_jsonb_deep_merge(v_result -> v_key, v_value),
        true
      );
    else
      v_result := jsonb_set(v_result, array[v_key], v_value, true);
    end if;
  end loop;
  return v_result;
end;
$$;

revoke all on function public.gosvt_jsonb_deep_merge(jsonb,jsonb) from public, anon, authenticated;

create or replace function public.gosvt_merge_student_platform_state(
  p_student_id uuid,
  p_profile_id text,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_merged jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_student_id then
    raise exception 'session_changed' using errcode = '42501';
  end if;
  if p_profile_id is null or length(p_profile_id) not between 1 and 128 then
    raise exception 'invalid_profile_id' using errcode = '22023';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  if pg_column_size(p_state) > 1048576 then
    raise exception 'state_too_large' using errcode = '22023';
  end if;

  -- Create the row if absent; ON CONFLICT serializes simultaneous first writes.
  insert into public.student_platform_state(student_id, profile_id, state, updated_at)
  values (p_student_id, p_profile_id, '{}'::jsonb, now())
  on conflict (student_id, profile_id) do nothing;

  -- Lock the account/profile row and merge against the latest committed state.
  select state into v_existing
  from public.student_platform_state
  where student_id = p_student_id and profile_id = p_profile_id
  for update;

  v_merged := public.gosvt_jsonb_deep_merge(v_existing, p_state);

  update public.student_platform_state
  set state = v_merged, updated_at = now()
  where student_id = p_student_id and profile_id = p_profile_id;

  return v_merged;
end;
$$;

revoke all on function public.gosvt_merge_student_platform_state(uuid,text,jsonb) from public, anon;
grant execute on function public.gosvt_merge_student_platform_state(uuid,text,jsonb) to authenticated;
 then
    v_right_reset := (p_right ->> '_resetAt')::bigint;
  end if;
  if coalesce(p_right ->> 'u', '') ~ '^[0-9]{1,16}
  for v_key, v_value in select key, value from jsonb_each(p_right)
  loop
    if v_result ? v_key then
      v_result := jsonb_set(
        v_result,
        array[v_key],
        public.gosvt_jsonb_deep_merge(v_result -> v_key, v_value),
        true
      );
    else
      v_result := jsonb_set(v_result, array[v_key], v_value, true);
    end if;
  end loop;
  return v_result;
end;
$$;

revoke all on function public.gosvt_jsonb_deep_merge(jsonb,jsonb) from public, anon, authenticated;

create or replace function public.gosvt_merge_student_platform_state(
  p_student_id uuid,
  p_profile_id text,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_merged jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_student_id then
    raise exception 'session_changed' using errcode = '42501';
  end if;
  if p_profile_id is null or length(p_profile_id) not between 1 and 128 then
    raise exception 'invalid_profile_id' using errcode = '22023';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  if pg_column_size(p_state) > 1048576 then
    raise exception 'state_too_large' using errcode = '22023';
  end if;

  -- Create the row if absent; ON CONFLICT serializes simultaneous first writes.
  insert into public.student_platform_state(student_id, profile_id, state, updated_at)
  values (p_student_id, p_profile_id, '{}'::jsonb, now())
  on conflict (student_id, profile_id) do nothing;

  -- Lock the account/profile row and merge against the latest committed state.
  select state into v_existing
  from public.student_platform_state
  where student_id = p_student_id and profile_id = p_profile_id
  for update;

  v_merged := public.gosvt_jsonb_deep_merge(v_existing, p_state);

  update public.student_platform_state
  set state = v_merged, updated_at = now()
  where student_id = p_student_id and profile_id = p_profile_id;

  return v_merged;
end;
$$;

revoke all on function public.gosvt_merge_student_platform_state(uuid,text,jsonb) from public, anon;
grant execute on function public.gosvt_merge_student_platform_state(uuid,text,jsonb) to authenticated;
 then
    v_right_updated := (p_right ->> 'u')::bigint;
  end if;

  -- A deliberate reset replaces the old snapshot. Older offline devices are
  -- prevented from resurrecting pre-reset collections until they rehydrate.
  if v_right_reset > v_left_reset then
    return p_right;
  elsif v_left_reset > v_right_reset and v_right_updated <= v_left_reset then
    return p_left;
  end if;

  v_result := p_left;
  for v_key, v_value in select key, value from jsonb_each(p_right)
  loop
    if v_result ? v_key then
      v_result := jsonb_set(
        v_result,
        array[v_key],
        public.gosvt_jsonb_deep_merge(v_result -> v_key, v_value),
        true
      );
    else
      v_result := jsonb_set(v_result, array[v_key], v_value, true);
    end if;
  end loop;
  return v_result;
end;
$$;

revoke all on function public.gosvt_jsonb_deep_merge(jsonb,jsonb) from public, anon, authenticated;

create or replace function public.gosvt_merge_student_platform_state(
  p_student_id uuid,
  p_profile_id text,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_merged jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_student_id then
    raise exception 'session_changed' using errcode = '42501';
  end if;
  if p_profile_id is null or length(p_profile_id) not between 1 and 128 then
    raise exception 'invalid_profile_id' using errcode = '22023';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  if pg_column_size(p_state) > 1048576 then
    raise exception 'state_too_large' using errcode = '22023';
  end if;

  -- Create the row if absent; ON CONFLICT serializes simultaneous first writes.
  insert into public.student_platform_state(student_id, profile_id, state, updated_at)
  values (p_student_id, p_profile_id, '{}'::jsonb, now())
  on conflict (student_id, profile_id) do nothing;

  -- Lock the account/profile row and merge against the latest committed state.
  select state into v_existing
  from public.student_platform_state
  where student_id = p_student_id and profile_id = p_profile_id
  for update;

  v_merged := public.gosvt_jsonb_deep_merge(v_existing, p_state);

  update public.student_platform_state
  set state = v_merged, updated_at = now()
  where student_id = p_student_id and profile_id = p_profile_id;

  return v_merged;
end;
$$;

revoke all on function public.gosvt_merge_student_platform_state(uuid,text,jsonb) from public, anon;
grant execute on function public.gosvt_merge_student_platform_state(uuid,text,jsonb) to authenticated;
