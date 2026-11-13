-- Two-phase deletion for owner-managed public resources.
-- A resource is hidden from public listings before its storage object is removed.
alter table public.site_content_items
  add column if not exists is_deleted boolean not null default false;

drop policy if exists site_content_public_read on public.site_content_items;
create policy site_content_public_read
on public.site_content_items for select
to anon, authenticated
using (is_deleted = false);

drop policy if exists site_content_admin_read on public.site_content_items;
create policy site_content_admin_read
on public.site_content_items for select
to authenticated
using (public.gosvt_is_site_admin());
