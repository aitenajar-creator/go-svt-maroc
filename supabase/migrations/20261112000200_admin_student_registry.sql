-- Private administrator-only student registry.
-- Reads signup metadata from auth.users without exposing auth.users to browser clients.
create or replace function public.gosvt_admin_student_registry()
returns table (
  student_id uuid,
  email text,
  display_name text,
  study_level text,
  study_track text,
  registered_at timestamptz,
  email_confirmed boolean
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.gosvt_is_site_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    u.email::text,
    coalesce(nullif(p.display_name, ''), nullif(u.raw_user_meta_data->>'display_name', ''), u.email)::text,
    nullif(u.raw_user_meta_data->>'study_level', '')::text,
    nullif(u.raw_user_meta_data->>'study_track', '')::text,
    u.created_at,
    (u.email_confirmed_at is not null)
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.role = 'student'
  order by u.created_at desc;
end;
$$;

revoke all on function public.gosvt_admin_student_registry() from public;
revoke all on function public.gosvt_admin_student_registry() from anon;
grant execute on function public.gosvt_admin_student_registry() to authenticated;
