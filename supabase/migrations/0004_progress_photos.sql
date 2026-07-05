-- IA-Muscu — 0004 : photos de progression physique (galerie + comparateur avant/après)
-- Les fichiers vivent dans le bucket Storage privé `photos` (créé par scripts/setup-storage.mjs).

create table if not exists progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  taken_at date not null default (now() at time zone 'Europe/Paris')::date,
  pose text not null check (pose in ('face','profil','dos')),
  photo_path text not null,           -- path dans le bucket privé (URL signée à l'affichage)
  notes text,
  created_at timestamptz default now()
);
create index if not exists progress_photos_user_date_idx on progress_photos (user_id, taken_at desc);

alter table progress_photos enable row level security;
drop policy if exists "progress_photos_own" on progress_photos;
create policy "progress_photos_own" on progress_photos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
