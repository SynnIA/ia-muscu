# IA-Muscu — Plan de construction

> Document d'exécution complet, destiné à un agent de code (Fable 5) qui construit l'app **lot par lot**.
> Auteur du besoin : Synnheal. Date : 2026-07-02.

---

## 0. En une phrase

Une **webapp** de coaching **musculation + nutrition** perso (un seul utilisateur), où une IA **pas chère** discute avec toi au quotidien, lit tes photos (repas, captures Strava), **mémorise tout** en base de données, et où **tout ce qui se calcule est fait par du code** (calories, macros, 1RM, graphiques) — jamais par l'IA.

**Deux modèles, deux rôles :**
- 🏗️ **Modèle costaud (Fable 5)** = **CONSTRUIT** l'app. Coût one-shot, pas récurrent.
- ⚡ **Modèle pas cher (Claude Haiku 4.5)** = **FAIT TOURNER** l'app au quotidien. Cible **≤ 2 €/mois**.

---

## 1. Ce que l'app doit faire (user stories)

| # | En tant que… | je veux… | pour que… |
|---|---|---|---|
| U1 | utilisateur | dire chaque matin « qu'est-ce que je fais aujourd'hui ? » | l'IA me propose ma séance/mon plan du jour à partir de mon historique et mes objectifs |
| U2 | utilisateur | envoyer une capture d'écran Strava (marche/course) | l'activité (durée, distance, calories) soit lue et enregistrée |
| U3 | utilisateur | décrire un repas + envoyer une photo | les calories et macros soient estimées et enregistrées |
| U4 | utilisateur | dire ce que j'ai fait à la salle (« 4×8 développé couché à 60 kg ») | la séance soit enregistrée avec volume + 1RM estimé |
| U5 | utilisateur | poser une question random genre « graphe-moi mon poids sur 3 mois » | un vrai graphique de mes données réelles s'affiche |
| U6 | utilisateur | que l'IA se souvienne de tout (objectifs, préférences, blessures, allergies) | je n'aie jamais à me répéter |
| U7 (plus tard) | utilisateur | **parler** à l'app et qu'elle réponde à voix haute | usage mains-libres pendant l'effort |

**Principe directeur (issu de la recherche, voir §8) :** *le LLM orchestre et explique, le code calcule.* Toute erreur arithmétique de l'IA est éliminée en déportant les calculs dans des fonctions déterministes exposées comme *tools*.

---

## 2. Stack technique (figée)

| Brique | Choix | Notes |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Une seule base de code, rendu mobile-first |
| Format | **Webapp + PWA légère** | Installable via « Ajouter à l'écran d'accueil » (gratuit, **aucun store**). Pas d'app native. |
| Base de données | **Supabase** (Postgres + `pgvector` + Auth + Storage) | La « mémoire » vit ici. Gratuit pour 1 user. |
| Pont IA | **Vercel AI SDK** | Chat, tool-calling, vision, streaming |
| Modèle runtime | **Claude Haiku 4.5** (`claude-haiku-4-5`) | 1 $/1M in, 5 $/1M out, supporte la vision |
| UI | **Tailwind CSS + shadcn/ui** | Rapide, propre |
| Graphiques | **Recharts** | Pour U5 (voir aussi la skill `dataviz` au lot P4) |
| Voix (P5) | **Web Speech API** (navigateur) | STT + TTS gratuits, aucun coût IA |
| Hébergement | **Vercel** (hobby) | Gratuit |

**Contrainte format (insistée par l'utilisateur) :** WEBAPP UNIQUEMENT. Jamais de build natif / App Store / Play Store (coût refusé). La PWA sert juste à avoir une icône plein écran.

---

## 3. Coûts

**Infra = 0 €/mois** : Vercel gratuit + Supabase gratuit + URL `*.vercel.app` gratuite.

**IA ≈ 2 €/mois** avec Haiku 4.5, pour un usage perso réaliste (~15 échanges + ~3 photos/jour) :

| Poste | ~ Coût/mois |
|---|---|
| Entrées (messages + photos) | ~0,60 $ |
| Contexte mis en cache | ~0,25 $ |
| Réponses de l'IA | ~0,90 $ |
| **Total** | **~1,8–2,3 $** |

**Les 5 leviers qui verrouillent le prix (à respecter pendant le dev) :**
1. **Tout calcul = code**, jamais l'IA (calories, macros, TDEE, 1RM, graphes).
2. **Prompt caching** sur le préfixe stable (system prompt + connaissances). Voir §6.
3. **Réponses courtes par défaut** : l'IA confirme en 1 phrase ; les bilans détaillés seulement sur demande explicite.
4. **Données de référence en local** (CIQUAL, exercices) → aucun appel répété.
5. **Voix par le navigateur**, pas par une IA payante.

> 💡 U5 (« graphe mon poids sur 3 mois ») coûte **~0 token** : l'IA appelle `generate_chart`, le code lit la base, Recharts dessine.

---

## 4. Architecture (flux d'un message)

```
[Webapp Next.js / mobile]
        │  message (texte + image éventuelle)
        ▼
[/api/chat  (Route Handler, streaming)]
        │  Vercel AI SDK → Claude Haiku 4.5
        │    - system prompt (préfixe caché) + résumé mémoire
        │    - tools déclarés (log_*, get_history, generate_chart, calc_*, ...)
        │    - vision (les images sont lues directement par le modèle)
        ▼
[Le modèle DÉCIDE d'appeler un tool]
        │
        ├── log_meal / log_workout / log_weight / log_activity  ─► écrit dans Supabase (le CODE calcule macros / 1RM)
        ├── get_history / generate_chart                        ─► lit Supabase, renvoie des données
        ├── calc_needs / estimate_1rm                           ─► fonctions déterministes (aucune DB)
        └── remember_fact / recall_facts                        ─► mémoire longue (pgvector RAG)
        ▼
[Réponse en streaming → UI]  + éventuel composant graphique (Recharts)
```

---

## 5. Schéma de base de données (Supabase / Postgres)

RLS **activée** sur toutes les tables `user_*` avec policy `user_id = auth.uid()`. Tables de référence (`foods`, `exercises`) en lecture pour tout utilisateur authentifié. Activer l'extension `vector` (pgvector).

**Données utilisateur :**

```sql
-- profil
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  birth_date date,
  height_cm numeric,
  sex text check (sex in ('M','F')),
  goal text check (goal in ('perte','maintien','prise')) default 'maintien',
  activity_factor numeric default 1.375,   -- Mifflin-St Jeor
  created_at timestamptz default now()
);

-- poids / mesures dans le temps
create table body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  measured_at date not null,
  weight_kg numeric,
  body_fat_pct numeric,
  notes text
);

-- cardio / marche (Strava ou manuel)
create table activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  occurred_at timestamptz not null,
  type text,                      -- 'marche','course','velo',...
  duration_min numeric,
  distance_km numeric,
  calories numeric,
  source text default 'manuel',   -- 'strava','manuel'
  raw jsonb                       -- extraction brute de la capture
);

-- séances + séries
create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  occurred_at timestamptz not null,
  name text,
  notes text
);
create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts on delete cascade,
  exercise_id uuid references exercises,
  exercise_name text not null,
  set_index int,
  reps int,
  weight_kg numeric,
  rpe numeric,
  est_1rm numeric                 -- calculé côté code (Epley/Brzycki)
);

-- repas + aliments
create table meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  eaten_at timestamptz not null,
  description text,
  photo_url text,
  kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric
);
create table meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals on delete cascade,
  food_id uuid references foods,
  food_name text not null,
  quantity_g numeric,
  kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric
);

-- conversation
create table messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role text check (role in ('user','assistant')) not null,
  content text,
  meta jsonb,
  created_at timestamptz default now()
);

-- mémoire longue (RAG)
create table memory_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  fact text not null,
  embedding vector(1536),
  source text,
  created_at timestamptz default now()
);
```

**Données de référence (chargées une fois, voir §8) :**

```sql
-- CIQUAL (aliments français) — teneurs pour 100 g
create table foods (
  id uuid primary key default gen_random_uuid(),
  ciqual_code text,
  name_fr text not null,
  kcal_100g numeric, protein_100g numeric, carbs_100g numeric, fat_100g numeric,
  fiber_100g numeric, sugar_100g numeric, salt_100g numeric,
  fts tsvector                    -- recherche plein texte FR
);

-- Free Exercise DB
create table exercises (
  id uuid primary key default gen_random_uuid(),
  ext_id text,
  name text not null,
  name_fr text,
  primary_muscles text[],
  secondary_muscles text[],
  equipment text,
  level text,                     -- beginner/intermediate/expert
  mechanic text,                  -- compound/isolation
  category text,
  instructions text[]
);
```

---

## 6. Les outils IA (signatures) — `lib/ai/tools.ts`

Le modèle **décide**, le code **fait**. Chaque tool valide ses entrées (Zod).

| Tool | Entrées | Ce que fait le CODE |
|---|---|---|
| `log_weight` | `{ date, weight_kg, body_fat_pct? }` | insert `body_metrics` |
| `log_meal` | `{ description, items?: [{food_name, quantity_g}], photo? }` | résout chaque aliment via `foods` (CIQUAL) ou Open Food Facts, **somme les macros**, insert `meals` + `meal_items` |
| `log_workout` | `{ name?, sets: [{exercise_name, reps, weight_kg, rpe?}] }` | **calcule `est_1rm`** (Epley/Brzycki), insert `workouts` + `workout_sets` |
| `log_activity` | `{ type, duration_min, distance_km?, calories?, source }` | insert `activities` |
| `get_history` | `{ metric, from, to }` | SELECT filtré, renvoie les lignes |
| `generate_chart` | `{ metric, period }` | renvoie une série `{x, y}[]` pour Recharts |
| `calc_needs` | `{}` | **Mifflin-St Jeor** TDEE + cibles macros à partir de `profiles` |
| `estimate_1rm` | `{ weight_kg, reps }` | moyenne Epley/Brzycki |
| `search_exercise` | `{ muscle?, equipment?, level? }` | SELECT sur `exercises` |
| `remember_fact` | `{ fact }` | embed + insert `memory_facts` |
| `recall_facts` | `{ query }` | recherche vectorielle (pgvector) top-k |

**Prompt caching :** le system prompt + le résumé condensé des recommandations (ISSN/ANSES, voir §8) forment un **préfixe stable** marqué `cache_control`. Le contexte volatil (message du jour, résumé mémoire) va **après** le point de cache. Vérifier `usage.cache_read_input_tokens > 0`.

---

## 7. Formules déterministes (à coder) — `lib/calc/`

**`energy.ts`**
- **BMR (Mifflin-St Jeor)** :
  - Homme : `10*poids_kg + 6.25*taille_cm − 5*age + 5`
  - Femme : `10*poids_kg + 6.25*taille_cm − 5*age − 161`
- **TDEE** = `BMR × facteur` (1.2 sédentaire · 1.375 léger · 1.55 modéré · 1.725 très actif · 1.9 extrême)
- **Objectif calorique** : `± 250 à 500 kcal/jour` selon `goal`
- **Macros** : protéines `1.6–2.2 g/kg` (cadre ISSN musculation), glucides `40–55 %` de l'AET (borne ANSES), reste en lipides.

**`strength.ts`**
- **1RM Epley** : `poids × (1 + reps/30)`
- **1RM Brzycki** : `poids / (1.0278 − 0.0278×reps)`
- Recommandé : **moyenner les deux** (fiable à 1–10 reps).
- Table **%1RM** pour prescrire les charges (ex. 80 % → séries de 8 hypertrophie ; 90 % → 3–4 force).

⚠️ Ces fonctions sont exposées comme *tools* et **jamais** laissées au LLM.

---

## 8. Sources de données de référence

Détaillées dans `Free Resources for an AI Nutrition and Strength Training Knowledge Base.pdf` (à la racine).

- **CIQUAL (ANSES)** — LA référence FR (~3 484 aliments). Dump XML/Excel → table `foods`. Pas d'API officielle → charger en local. Licence open data.
- **Free Exercise DB** (`yuhonas/free-exercise-db`) — 800+ exercices JSON, domaine public → table `exercises`. Traduire noms/instructions en FR **par batch, une seule fois** (pré-traitement), pas à l'exécution.
- **Open Food Facts** — API gratuite sans clé, par **code-barres** (`/api/v2/product/{barcode}.json`), avec **cache agressif** en base. Pour les produits emballés.
- **ISSN (position stands) + ANSES/PNNS** — résumés condensés en fiches markdown → chunk + embeddings → `pgvector` (RAG). Injecter un **résumé court** dans le system prompt, pas les PDF entiers. Citer les sources.

---

## 9. Structure du repo

```
ia-muscu/
  app/
    (auth)/login/page.tsx
    (app)/
      layout.tsx
      chat/page.tsx
    api/chat/route.ts          # endpoint IA streaming + tools + vision
    manifest.ts                # PWA (icône, écran d'accueil)
  components/
    chat/            (bulles, composer, upload photo)
    charts/          (Recharts)
    ui/              (shadcn)
  lib/
    ai/
      model.ts       # config Haiku + prompt caching
      prompt.ts      # system prompt (préfixe caché) + résumé ISSN/ANSES
      tools.ts       # définitions des tools (Zod)
    calc/
      energy.ts      # Mifflin-St Jeor, TDEE, macros
      strength.ts    # Epley/Brzycki, %1RM
    db/
      client.ts      # clients Supabase (server / browser)
      queries.ts
    food/off.ts      # Open Food Facts (code-barres + cache)
    memory/rag.ts    # embeddings + recherche vectorielle
  supabase/
    migrations/      # *.sql (schéma §5)
    seed/            # import CIQUAL + Free Exercise DB
  public/            # icônes PWA, manifest assets
  .env.local         # voir §11
```

---

## 10. Plan par lots (avec critères d'acceptation)

> Attaquer **dans l'ordre**, un lot à la fois. Chaque lot est livrable et testable seul.

### P0 — Fondations
- `create-next-app` (App Router, TS, Tailwind), shadcn/ui, config PWA (`manifest.ts`, icônes).
- Projet Supabase + **Auth** (magic link email, un seul user).
- Branchement Vercel AI SDK + `ANTHROPIC_API_KEY`, écran `chat` qui parle à Haiku 4.5 (sans tools).
- **✅ Acceptation :** l'app se déploie sur Vercel, s'installe en icône sur le tel, et répond en chat en streaming.

### P1 — Mémoire + logging texte
- Migrations SQL (§5, tables user) + RLS.
- Tools `log_weight`, `log_meal` (texte), `log_workout`, `log_activity`, `get_history`, `remember_fact`/`recall_facts`.
- **✅ Acceptation :** « j'ai fait 4×8 développé couché à 60 kg » → enregistré ; « c'était quoi ma dernière séance pecs ? » → relu correctement.

### P2 — Vision
- Upload photo (repas + capture Strava) → Supabase Storage (ou analyse éphémère sans stockage).
- Le modèle lit l'image → extrait les infos → appelle le bon `log_*`.
- **✅ Acceptation :** photo de repas → macros estimées loggées ; capture Strava → activité loggée (durée/distance/calories).

### P3 — Socle nutrition/muscu (le PDF)
- Import **CIQUAL** → `foods` (+ FTS). Import **Free Exercise DB** → `exercises` (traduction FR par batch une fois).
- `lib/calc/energy.ts` + `strength.ts` exposés comme tools `calc_needs`, `estimate_1rm`.
- Open Food Facts par code-barres (cache). Fiches ISSN/ANSES condensées → RAG pgvector.
- **✅ Acceptation :** calories/macros exactes via CIQUAL ; TDEE calculé ; reco scientifiques citées.

### P4 — Graphiques & bilans
- Tool `generate_chart` + composants Recharts (courbe de poids, volume par muscle, calories/jour).
- Bilans (« résumé de ma semaine »).
- **⚠️ Lire la skill `dataviz` AVANT d'écrire du code de graphique** (couleurs, axes, accessibilité).
- **✅ Acceptation :** « graphe mon poids sur 3 mois » → courbe de mes vraies données.

### P5 — Voix & finitions
- Web Speech API (dictée + réponse vocale), notifications (rappel séance), offline PWA, polish.
- **✅ Acceptation :** je parle, l'app répond à voix haute ; fonctionne hors-ligne pour la consultation.

---

## 11. Variables d'environnement (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # clé publishable
SUPABASE_SERVICE_ROLE_KEY=...            # SECRET, serveur uniquement (jamais exposée au client)
ANTHROPIC_API_KEY=...
```

Open Food Facts ne nécessite **aucune clé** (juste un `User-Agent` clair + cache).

---

## 12. Étapes de démarrage pour Synnheal (à faire une fois)

1. Créer un projet **Supabase** gratuit → copier `URL`, `anon key`, `service_role key`.
2. Créer un compte **Anthropic** → générer une **clé API**.
3. (Optionnel) Compte **Vercel** → connecter le repo GitHub pour le déploiement auto.
4. Remplir `.env.local`.

*(L'agent de code guide pas à pas au moment de P0.)*

---

## 13. Consignes pour l'agent de code (Fable 5)

- **Construire lot par lot** (P0 → P5). Ne pas tout faire d'un coup ; livrer et tester chaque lot.
- **Minimiser le diff.** Comprendre avant de modifier.
- **Ne JAMAIS laisser le LLM calculer** : calories, macros, TDEE, 1RM, graphiques = fonctions déterministes en TS, exposées comme tools.
- **Verrouiller le coût runtime** : Haiku 4.5, prompt caching sur le préfixe stable, réponses courtes par défaut, données de réf en local (voir §3).
- **Sécurité** : RLS activée sur toutes les tables user ; `service_role key` jamais côté client ; valider toutes les entrées (Zod).
- **Signaler les risques** avant toute migration destructive ou changement auth.
- Au lot **P4**, invoquer la skill **`dataviz`** avant d'écrire le moindre graphique.
- Après chaque lot : proposer les vérifications utiles (lint, build, test ciblé).
```
