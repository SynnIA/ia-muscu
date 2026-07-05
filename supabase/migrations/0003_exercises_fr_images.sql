-- IA-Muscu — 0003 : exercices en français + images (Free Exercise DB)
alter table exercises
  add column if not exists images text[] default '{}',
  add column if not exists instructions_fr text[] default '{}';

create index if not exists exercises_name_fr_idx on exercises (lower(name_fr));
