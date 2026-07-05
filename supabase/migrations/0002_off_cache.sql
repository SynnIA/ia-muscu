-- IA-Muscu — 0002 : cache Open Food Facts (produits scannés par code-barres)
create table if not exists off_cache (
  barcode text primary key,
  name text,
  brand text,
  kcal_100g numeric,
  protein_100g numeric,
  carbs_100g numeric,
  fat_100g numeric,
  raw jsonb,
  fetched_at timestamptz default now()
);

alter table off_cache enable row level security;

-- Lecture pour tout utilisateur connecté ; écriture réservée au serveur
-- (le tool passe par la session utilisateur → on autorise aussi l'insert authenticated)
drop policy if exists "off_cache_read" on off_cache;
create policy "off_cache_read" on off_cache for select to authenticated using (true);
drop policy if exists "off_cache_write" on off_cache;
create policy "off_cache_write" on off_cache for insert to authenticated with check (true);
drop policy if exists "off_cache_update" on off_cache;
create policy "off_cache_update" on off_cache for update to authenticated using (true) with check (true);
