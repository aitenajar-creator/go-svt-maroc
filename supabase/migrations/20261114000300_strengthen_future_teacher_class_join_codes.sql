-- New teacher classes receive 20-character hexadecimal invitation codes (80 bits).
-- Existing codes are intentionally preserved so currently shared invitations keep working.
alter table public.teacher_classes
  alter column join_code
  set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
