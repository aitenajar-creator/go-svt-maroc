-- Prevent repeated uploads of identical file bytes within the same content classification.
-- Existing rows are intentionally left untouched; their file_sha256 remains NULL.
alter table public.site_content_items
  add column if not exists file_sha256 text;

create or replace function public.prevent_duplicate_site_content_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.file_sha256 is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws('|',
        new.category,
        coalesce(new.language, ''),
        coalesce(new.study_level, ''),
        coalesce(new.study_track, ''),
        new.file_sha256
      ),
      0
    )
  );

  if exists (
    select 1
    from public.site_content_items existing
    where existing.category = new.category
      and existing.language is not distinct from new.language
      and existing.study_level is not distinct from new.study_level
      and existing.study_track is not distinct from new.study_track
      and existing.file_sha256 = new.file_sha256
      and existing.id is distinct from new.id
  ) then
    raise exception 'DUPLICATE_SITE_CONTENT: This file has already been published in this category and classification.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists site_content_prevent_duplicate_upload on public.site_content_items;
create trigger site_content_prevent_duplicate_upload
before insert or update of category, language, study_level, study_track, file_sha256
on public.site_content_items
for each row
execute function public.prevent_duplicate_site_content_upload();

create unique index if not exists site_content_unique_file_fingerprint
on public.site_content_items (
  category,
  coalesce(language, ''),
  coalesce(study_level, ''),
  coalesce(study_track, ''),
  file_sha256
)
where file_sha256 is not null;
