-- Extend the existing community library classification and add private,
-- account-scoped bookmarks. Apply only to the dedicated teacher-community project.

alter table public.teacher_community_resources
  add column if not exists school_level text,
  add column if not exists school_stream text,
  add column if not exists language text,
  add column if not exists chapter text,
  add column if not exists theme text,
  add column if not exists school_year text;

alter table public.teacher_community_resources
  add constraint teacher_community_resource_school_level_valid
    check (school_level is null or school_level in ('tc','1bac','2bac')),
  add constraint teacher_community_resource_school_stream_valid
    check (school_stream is null or school_stream in ('experimental','svt','physics','math','other')),
  add constraint teacher_community_resource_language_valid
    check (language is null or language in ('fr','ar')),
  add constraint teacher_community_resource_chapter_length
    check (chapter is null or char_length(chapter) <= 160),
  add constraint teacher_community_resource_theme_length
    check (theme is null or char_length(theme) <= 120),
  add constraint teacher_community_resource_school_year_valid
    check (school_year is null or school_year ~ '^[0-9]{4}-[0-9]{4}$');

create index if not exists teacher_community_resources_library_facets_idx
  on public.teacher_community_resources(school_level, school_stream, language, created_at desc)
  where status = 'published' and is_shared = true;

create index if not exists teacher_community_resources_school_year_idx
  on public.teacher_community_resources(school_year, created_at desc)
  where status = 'published' and is_shared = true;

create table if not exists public.teacher_community_resource_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.teacher_community_resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create index if not exists teacher_community_resource_favorites_user_created_idx
  on public.teacher_community_resource_favorites(user_id, created_at desc, resource_id);

alter table public.teacher_community_resource_favorites enable row level security;
revoke all privileges on table public.teacher_community_resource_favorites
  from public, anon, authenticated;
grant select, insert, delete on table public.teacher_community_resource_favorites
  to authenticated;

drop policy if exists teacher_community_resource_favorites_read_own
  on public.teacher_community_resource_favorites;
create policy teacher_community_resource_favorites_read_own
on public.teacher_community_resource_favorites
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists teacher_community_resource_favorites_insert_visible
  on public.teacher_community_resource_favorites;
create policy teacher_community_resource_favorites_insert_visible
on public.teacher_community_resource_favorites
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    public.gosvt_teacher_community_is_admin()
    or public.gosvt_teacher_community_is_approved_member()
  )
  and exists (
    select 1
    from public.teacher_community_resources r
    where r.id = resource_id
      and r.status = 'published'
      and r.is_shared = true
  )
);

drop policy if exists teacher_community_resource_favorites_delete_own
  on public.teacher_community_resource_favorites;
create policy teacher_community_resource_favorites_delete_own
on public.teacher_community_resource_favorites
for delete to authenticated
using (user_id = (select auth.uid()));
