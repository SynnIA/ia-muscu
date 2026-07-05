-- IA-Muscu — 0001 : extensions + tables de référence + tables utilisateur + RLS
-- Appliqué via scripts/db-migrate.mjs

-- =========================================================
-- Extensions
-- =========================================================
create extension if not exists vector;

-- =========================================================
-- Tables de référence (seedées au lot P3, vides d'ici là)
-- =========================================================
create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  ciqual_code text unique,
  name_fr text not null,
  kcal_100g numeric,
  protein_100g numeric,
  carbs_100g numeric,
  fat_100g numeric,
  fiber_100g numeric,
  sugar_100g numeric,
  salt_100g numeric,
  fts tsvector generated always as (to_tsvector('french', name_fr)) stored
);
create index if not exists foods_fts_idx on foods using gin (fts);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  ext_id text unique,
  name text not null,
  name_fr text,
  primary_muscles text[] default '{}',
  secondary_muscles text[] default '{}',
  equipment text,
  level text,
  mechanic text,
  category text,
  instructions text[] default '{}'
);
create index if not exists exercises_name_idx on exercises (lower(name));

-- =========================================================
-- Tables utilisateur
-- =========================================================
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  birth_date date,
  height_cm numeric,
  sex text check (sex in ('M','F')),
  goal text check (goal in ('perte','maintien','prise')) default 'maintien',
  activity_factor numeric default 1.375,
  created_at timestamptz default now()
);

create table if not exists body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  measured_at date not null default (now() at time zone 'Europe/Paris')::date,
  weight_kg numeric,
  body_fat_pct numeric,
  notes text,
  created_at timestamptz default now()
);
create index if not exists body_metrics_user_date_idx on body_metrics (user_id, measured_at desc);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  occurred_at timestamptz not null default now(),
  type text not null,
  duration_min numeric,
  distance_km numeric,
  calories numeric,
  source text default 'manuel',
  raw jsonb,
  created_at timestamptz default now()
);
create index if not exists activities_user_date_idx on activities (user_id, occurred_at desc);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  occurred_at timestamptz not null default now(),
  name text,
  notes text,
  created_at timestamptz default now()
);
create index if not exists workouts_user_date_idx on workouts (user_id, occurred_at desc);

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts on delete cascade,
  exercise_id uuid references exercises,
  exercise_name text not null,
  set_index int not null default 1,
  reps int,
  weight_kg numeric,
  rpe numeric,
  est_1rm numeric
);
create index if not exists workout_sets_workout_idx on workout_sets (workout_id);

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  eaten_at timestamptz not null default now(),
  description text,
  photo_url text,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  source text default 'estimation',   -- 'estimation' (P1) | 'ciqual' | 'off' (P3)
  created_at timestamptz default now()
);
create index if not exists meals_user_date_idx on meals (user_id, eaten_at desc);

create table if not exists meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals on delete cascade,
  food_id uuid references foods,
  food_name text not null,
  quantity_g numeric,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric
);
create index if not exists meal_items_meal_idx on meal_items (meal_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text,
  parts jsonb,
  created_at timestamptz default now()
);
create index if not exists messages_user_date_idx on messages (user_id, created_at desc);

create table if not exists memory_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  fact text not null,
  embedding vector(384),              -- gte-small (gratuit) au P3 ; null d'ici là
  source text,
  created_at timestamptz default now()
);
create index if not exists memory_facts_user_idx on memory_facts (user_id, created_at desc);

-- =========================================================
-- RLS
-- =========================================================
alter table foods enable row level security;
alter table exercises enable row level security;
alter table profiles enable row level security;
alter table body_metrics enable row level security;
alter table activities enable row level security;
alter table workouts enable row level security;
alter table workout_sets enable row level security;
alter table meals enable row level security;
alter table meal_items enable row level security;
alter table messages enable row level security;
alter table memory_facts enable row level security;

-- Référentiels : lecture pour tout utilisateur connecté
drop policy if exists "foods_read" on foods;
create policy "foods_read" on foods for select to authenticated using (true);
drop policy if exists "exercises_read" on exercises;
create policy "exercises_read" on exercises for select to authenticated using (true);

-- profiles : l'utilisateur ne voit/édite que sa ligne
drop policy if exists "profiles_own" on profiles;
create policy "profiles_own" on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Tables avec user_id direct
do $$
declare t text;
begin
  foreach t in array array['body_metrics','activities','workouts','meals','messages','memory_facts']
  loop
    execute format('drop policy if exists "%s_own" on %I', t, t);
    execute format(
      'create policy "%s_own" on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t
    );
  end loop;
end $$;

-- Tables enfants : accès via le parent
drop policy if exists "workout_sets_own" on workout_sets;
create policy "workout_sets_own" on workout_sets for all to authenticated
  using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));

drop policy if exists "meal_items_own" on meal_items;
create policy "meal_items_own" on meal_items for all to authenticated
  using (exists (select 1 from meals m where m.id = meal_id and m.user_id = auth.uid()))
  with check (exists (select 1 from meals m where m.id = meal_id and m.user_id = auth.uid()));
