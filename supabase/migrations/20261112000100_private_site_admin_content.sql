-- GO SVT Maroc: private owner-only content administration.
-- Existing content and student/teacher tables are not modified.
-- Public visitors may read published resource metadata/files; only site admins may write.

create or replace function public.gosvt_is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function public.gosvt_is_site_admin() from public;
grant execute on function public.gosvt_is_site_admin() to anon, authenticated;

create table if not exists public.site_content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 180),
  category text not null check (category in ('cours','exercices','examens','fiches','resumes','documents','ressources','divers')),
  language text check (language is null or language in ('francais','arabe')),
  study_level text check (study_level is null or study_level in ('TC','1BAC','2BAC')),
  study_track text check (study_track is null or study_track in ('TCS','TCL','1BACSE','1BACSM','1BACL','2BACSVT','2BACSP','2BACSM')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_content_items_category_idx
  on public.site_content_items(category, language, study_level, created_at desc);

alter table public.site_content_items enable row level security;

drop policy if exists site_content_public_read on public.site_content_items;
create policy site_content_public_read
on public.site_content_items for select
to anon, authenticated
using (true);

drop policy if exists site_content_admin_insert on public.site_content_items;
create policy site_content_admin_insert
on public.site_content_items for insert
to authenticated
with check (public.gosvt_is_site_admin() and created_by = (select auth.uid()));

drop policy if exists site_content_admin_update on public.site_content_items;
create policy site_content_admin_update
on public.site_content_items for update
to authenticated
using (public.gosvt_is_site_admin())
with check (public.gosvt_is_site_admin());

drop policy if exists site_content_admin_delete on public.site_content_items;
create policy site_content_admin_delete
on public.site_content_items for delete
to authenticated
using (public.gosvt_is_site_admin());

grant select on public.site_content_items to anon, authenticated;
grant insert, update, delete on public.site_content_items to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-content',
  'site-content',
  true,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_content_storage_admin_insert on storage.objects;
create policy site_content_storage_admin_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'site-content' and public.gosvt_is_site_admin());

drop policy if exists site_content_storage_admin_update on storage.objects;
create policy site_content_storage_admin_update
on storage.objects for update
to authenticated
using (bucket_id = 'site-content' and public.gosvt_is_site_admin())
with check (bucket_id = 'site-content' and public.gosvt_is_site_admin());

drop policy if exists site_content_storage_admin_delete on storage.objects;
create policy site_content_storage_admin_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'site-content' and public.gosvt_is_site_admin());
