-- Editable public founder profile, managed only by authenticated site admins.
create table if not exists public.site_founder_profile (
  id text primary key check (id = 'main'),
  name_ar text not null default 'عبد الحق أيت النجار',
  name_fr text not null default 'Abdelhaq Ait Enajar',
  role_ar text not null default 'أستاذ التعليم الثانوي التأهيلي',
  role_fr text not null default 'Professeur de l’enseignement secondaire qualifiant',
  bio_ar text not null default '',
  bio_fr text not null default '',
  vision_ar text not null default '',
  vision_fr text not null default '',
  portrait_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.site_founder_profile enable row level security;
drop policy if exists site_founder_public_read on public.site_founder_profile;
create policy site_founder_public_read on public.site_founder_profile
for select to anon, authenticated using (true);
drop policy if exists site_founder_admin_insert on public.site_founder_profile;
create policy site_founder_admin_insert on public.site_founder_profile
for insert to authenticated
with check (public.gosvt_is_site_admin() and updated_by = (select auth.uid()));
drop policy if exists site_founder_admin_update on public.site_founder_profile;
create policy site_founder_admin_update on public.site_founder_profile
for update to authenticated
using (public.gosvt_is_site_admin())
with check (public.gosvt_is_site_admin() and updated_by = (select auth.uid()));
grant select on public.site_founder_profile to anon, authenticated;
grant insert, update on public.site_founder_profile to authenticated;
insert into public.site_founder_profile
(id,name_ar,name_fr,role_ar,role_fr,bio_ar,bio_fr,vision_ar,vision_fr)
values (
 'main',
 'عبد الحق أيت النجار',
 'Abdelhaq Ait Enajar',
 'أستاذ التعليم الثانوي التأهيلي',
 'Professeur de l’enseignement secondaire qualifiant',
 'مؤسس منصة GO SVT Maroc، وهي مبادرة تربوية رقمية تهدف إلى تطوير تعلم وتعليم علوم الحياة والأرض بالمغرب، من خلال توفير موارد تعليمية منظمة ومتاحة للتلاميذ والأساتذة. جاءت فكرة المنصة انطلاقاً من الرغبة في توظيف التكنولوجيا لخدمة المدرسة، وجمع الدروس والتمارين والامتحانات والموارد التربوية في فضاء واحد يساعد على التعلم الذاتي وتبادل الخبرات.',
 'Fondateur de GO SVT Maroc, une initiative éducative numérique qui vise à enrichir l’apprentissage et l’enseignement des Sciences de la Vie et de la Terre au Maroc, en mettant à disposition des ressources pédagogiques structurées pour les élèves et les enseignants. La plateforme est née de la volonté de mettre le numérique au service de l’école, en réunissant cours, exercices, examens et ressources pédagogiques dans un espace qui encourage l’autonomie et le partage des pratiques.',
 'تعليم رقمي حديث، متاح للجميع، يجعل تعلم علوم الحياة والأرض أكثر تفاعلاً وفعالية.',
 'Un enseignement numérique moderne et accessible à tous, pour rendre l’apprentissage des SVT plus interactif et plus efficace.'
) on conflict (id) do nothing;
