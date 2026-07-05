# 🔥 La Forge — coach musculation & nutrition IA

Webapp PWA **mono-utilisateur** de coaching muscu + nutrition. Une IA pas chère (Claude Haiku 4.5) discute, lit les photos (repas, captures Strava, physique) et mémorise tout — **le LLM parle, le code calcule** (TDEE, macros, 1RM, totaux, graphiques).

**Prod : https://ia-muscu.vercel.app** (auto-deploy à chaque push sur `main`).

## Fonctionnalités

- **📅 Journal** — vue par jour (totaux kcal/prot/volume/cardio calculés par le code), saisie rapide en langage naturel, mini-calendrier du mois, miniatures des photos de repas.
- **💬 Coach** — chat à 2 modes :
  - **📝 Info** : log éclair (« 4×8 squat à 80 kg ») → prompt minimal, ~0,001 $/log, réponse en 1 phrase ;
  - **💬 Question** : coach complet (ton « pote de salle »), avec un **état des lieux chiffré sur 4 mois** injecté à chaque message (poids, moyennes nutrition, progression 1RM…) calculé par `lib/ai/summary.ts`.
  - Vision (photo de repas → macros CIQUAL, capture Strava → activité), graphiques Recharts inline, dictée + lecture vocale (Web Speech, gratuit).
- **🏋️ Exos** — 873 exercices (Free Exercise DB) traduits FR, filtres muscle/matériel, images.
- **📸 Photos** — photos de physique par pose (face/profil/dos), **comparateur avant/après à curseur**, avis du coach à la demande. Bucket Supabase privé, URLs signées.

## Stack

Next.js 16 (App Router) · Supabase (Postgres + RLS, Auth, Storage) · Vercel AI SDK v7 + `claude-haiku-4-5` · Tailwind v4 · Recharts. Coût cible : **0 €/mois d'infra + ~2 €/mois d'IA** (prompt caching, calculs en code, données de référence en local).

⚠️ AI SDK **v7** : les blocs system passent par l'option `instructions` — jamais dans `messages`.

## Dev local

```bash
npm install
cp .env.example .env.local   # voir variables ci-dessous
npm run dev
```

Variables (`.env.local`) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` (server-only), `ANTHROPIC_API_KEY`, `ALLOWED_EMAIL` (garde mono-utilisateur), `SUPABASE_DB_PASSWORD` (migrations locales uniquement).

Scripts :

```bash
node scripts/db-migrate.mjs      # migrations SQL (pooler IPv4 + CA certs/supabase-ca.pem)
node scripts/setup-storage.mjs   # bucket privé `photos` (idempotent)
node scripts/seed-ciqual.mjs     # 3 186 aliments CIQUAL (ANSES)
node scripts/seed-exercises.mjs  # 873 exercices Free Exercise DB
```

Pièges WSL sur `/mnt/c` : cache `.next` qui se corrompt (`rm -rf .next`), tuer le dev server avec `pkill -f "[n]ext dev"`.

## Docs

- `PLAN.md` — spec complète d'origine (schéma DB, tools, formules, lots P0→P5)
- `HANDOFF.md` — changelog de construction et état courant
- `CLAUDE.md` — règles pour l'agent de code
