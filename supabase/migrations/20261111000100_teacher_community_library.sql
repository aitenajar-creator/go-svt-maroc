-- GO SVT Maroc — Independent teacher community and shared pedagogical library.
-- Additive migration: does not alter existing student, teacher-classroom or admin tables.
-- Run once in Supabase SQL Editor after reviewing the project backup.

create extension if not exists pgcrypto;

create or replace function public.gosvt_teacher_community_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create table if not exists public.teacher_community_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 100),
  professional_title text not null default '',
  school_name text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_community_members_status_idx
  on public.teacher_community_members(status, created_at desc);

create or replace function public.gosvt_teacher_community_is_approved_member()
returns boolean
language sql stable security definer
set search_path = public
as $
  select exists (
    select 1 from public.teacher_community_members m
    where m.user_id = (select auth.uid()) and m.status = 'approved'
  );
$;

create table if not exists public.teacher_community_resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text not null default '' check (char_length(description) <= 3000),
  category text not null default 'other'
    check (category in ('curriculum','lesson','presentation','assessment','exam','correction','planning','professional','training','other')),
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  is_shared boolean not null default true,
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_community_resources_created_idx
  on public.teacher_community_resources(status, is_shared, created_at desc);
create index if not exists teacher_community_resources_owner_idx
  on public.teacher_community_resources(owner_id, created_at desc);
create index if not exists teacher_community_resources_category_idx
  on public.teacher_community_resources(category, created_at desc);

alter table public.teacher_community_members enable row level security;
alter table public.teacher_community_resources enable row level security;

drop policy if exists teacher_community_member_read_self_or_admin on public.teacher_community_members;
create policy teacher_community_member_read_self_or_admin
on public.teacher_community_members for select to authenticated
using (user_id = (select auth.uid()) or public.gosvt_teacher_community_is_admin());

drop policy if exists teacher_community_member_register_self on public.teacher_community_members;
create policy teacher_community_member_register_self
on public.teacher_community_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
);

drop policy if exists teacher_community_member_update_admin on public.teacher_community_members;
create policy teacher_community_member_update_admin
on public.teacher_community_members for update to authenticated
using (public.gosvt_teacher_community_is_admin())
with check (public.gosvt_teacher_community_is_admin());

drop policy if exists teacher_community_resource_read on public.teacher_community_resources;
create policy teacher_community_resource_read
on public.teacher_community_resources for select to authenticated
using (
  owner_id = (select auth.uid())
  or public.gosvt_teacher_community_is_admin()
  or (
    is_shared = true and status = 'published'
    and public.gosvt_teacher_community_is_approved_member()
  )
);

drop policy if exists teacher_community_resource_insert on public.teacher_community_resources;
create policy teacher_community_resource_insert
on public.teacher_community_resources for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (
    public.gosvt_teacher_community_is_admin()
    or (
      public.gosvt_teacher_community_is_approved_member()
      and (storage.foldername(storage_path))[1] = (select auth.uid())::text
    )
  )
);

drop policy if exists teacher_community_resource_update_owner_or_admin on public.teacher_community_resources;
create policy teacher_community_resource_update_owner_or_admin
on public.teacher_community_resources for update to authenticated
using (owner_id = (select auth.uid()) or public.gosvt_teacher_community_is_admin())
with check (
  (owner_id = (select auth.uid()) or public.gosvt_teacher_community_is_admin())
  and (
    public.gosvt_teacher_community_is_admin()
    or (storage.foldername(storage_path))[1] = (select auth.uid())::text
  )
);

drop policy if exists teacher_community_resource_delete_owner_or_admin on public.teacher_community_resources;
create policy teacher_community_resource_delete_owner_or_admin
on public.teacher_community_resources for delete to authenticated
using (owner_id = (select auth.uid()) or public.gosvt_teacher_community_is_admin());

-- Private bucket: downloads are issued as short-lived signed URLs by the portal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'teacher-community',
  'teacher-community',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/zip'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists teacher_community_storage_upload_own on storage.objects;
create policy teacher_community_storage_upload_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'teacher-community'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    public.gosvt_teacher_community_is_admin()
    or public.gosvt_teacher_community_is_approved_member()
  )
);

drop policy if exists teacher_community_storage_read on storage.objects;
create policy teacher_community_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'teacher-community'
  and exists (
    select 1 from public.teacher_community_resources r
    where r.storage_path = storage.objects.name
  )
);

drop policy if exists teacher_community_storage_delete_own on storage.objects;
create policy teacher_community_storage_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'teacher-community'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.gosvt_teacher_community_is_admin()
  )
);

drop policy if exists teacher_community_storage_update_own on storage.objects;
create policy teacher_community_storage_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'teacher-community'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.gosvt_teacher_community_is_admin()
  )
)
with check (
  bucket_id = 'teacher-community'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.gosvt_teacher_community_is_admin()
  )
);

grant select, insert, update, delete on public.teacher_community_members to authenticated;
grant select, insert, update, delete on public.teacher_community_resources to authenticated;
