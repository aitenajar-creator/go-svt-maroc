-- GO SVT Maroc: enforce valid Moroccan study-level / track combinations.
-- Existing rows were checked before adding this constraint; no invalid pairs were found.
-- This is additive and does not modify existing class records.

alter table public.teacher_classes
  add constraint teacher_classes_level_track_pair_check
  check (
    (study_level = 'TC' and study_track in ('TCS', 'TCL'))
    or
    (study_level = '1BAC' and study_track in ('1BACSE', '1BACSM', '1BACL'))
    or
    (study_level = '2BAC' and study_track in ('2BACSVT', '2BACSP', '2BACSM'))
  ) not valid;

alter table public.teacher_classes
  validate constraint teacher_classes_level_track_pair_check;
