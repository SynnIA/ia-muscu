<div align="center">

# 🔥 La Forge

### Coach musculation & nutrition IA — *le LLM parle, le code calcule.*

[🇬🇧 English](README.md) · **Français**

[![En prod](https://img.shields.io/badge/statut-en%20prod-FF3D00?style=flat-square)](https://ia-muscu.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-v7-000000?style=flat-square&logo=vercel&logoColor=white)](https://sdk.vercel.ai)
[![Claude Haiku 4.5](https://img.shields.io/badge/Claude-Haiku%204.5-D97757?style=flat-square&logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

**▶ En ligne : [ia-muscu.vercel.app](https://ia-muscu.vercel.app)**

PWA mono-utilisateur qui journalise entraînements et nutrition en langage naturel,
lit les photos (repas, physique, captures d'activité) et suit la progression sur
plusieurs mois — pour **~2 €/mois** d'IA.

</div>

---

## 📖 La genèse

Je voulais un coach de muscu et de nutrition qui me suive vraiment : qui se souvienne
de mes séances, calcule mes besoins, lise la photo de mon assiette et me dise où j'en
suis. Les apps du marché sont soit des tableurs déguisés, soit des abonnements à
10-20 €/mois. Objectif : **le faire moi-même pour le prix d'un café par mois.**

Sauf qu'un LLM, quand on lui demande « combien de calories dans ce repas » ou « quel
est mon 1RM », **invente des chiffres plausibles mais faux**. Il additionne mal, arrondit
au hasard, « hallucine » un TDEE. Inacceptable pour un outil de suivi où le chiffre
*est* le produit.

D'où le principe qui structure tout le projet :

> ### 🗣️ Le LLM parle. 🧮 Le code calcule.
>
> Le modèle comprend le langage naturel, décide **quoi** faire et rédige la réponse.
> Mais chaque nombre — calories, macros, TDEE, 1RM, volume, points d'un graphique —
> sort d'une **fonction TypeScript déterministe et testable à la main**, exposée au
> modèle comme *tool*. L'IA ne fait jamais une addition qui compte.

Résultat : la conversation est fluide *et* les chiffres sont exacts et reproductibles.

---

## ✨ Ce que ça fait

- **📅 Journal** — vue par jour : totaux kcal / protéines / volume / cardio **calculés par le code**, saisie rapide en langage naturel, mini-calendrier du mois, miniatures des photos de repas.
- **💬 Coach** — chat à deux modes :
  - **📝 Info** — log éclair (« 4×8 squat à 80 kg ») : prompt minimal, sous-ensemble de tools, réponse en une phrase. ~0,001 $ le log.
  - **💬 Question** — coach complet (ton « pote de salle »), avec un **état des lieux chiffré sur 4 mois** (poids, moyennes nutrition, progression 1RM…) recalculé par le code et injecté à chaque message.
  - **Vision** : photo de repas → macros CIQUAL ; capture d'activité → séance de cardio.
  - **Graphiques Recharts inline** générés à la demande, sur données réelles.
  - **Voix** : dictée + lecture (Web Speech API, gratuit).
- **🏋️ Exos** — 873 exercices (Free Exercise DB) traduits en FR, filtres muscle / matériel / niveau, images.
- **📸 Photos** — clichés de physique par pose (face / profil / dos), **comparateur avant/après à curseur**, avis du coach à la demande. Bucket Supabase privé, URLs signées.

---

## 🧱 Sous le capot

### Architecture

```
app/            Next.js App Router — onglets (journal, chat, exos, photos), auth, API routes
components/     UI React (chat, charts Recharts, comparateur photos, nav…)
lib/
 ├─ ai/         prompt (préfixe cachable) · summary (état des lieux 4 mois) · tools · knowledge (fiches ISSN/ANSES)
 ├─ calc/       energy.ts (BMR Mifflin-St Jeor, TDEE, macros) · strength.ts (1RM Epley/Brzycki, table %1RM)  ← le CODE calcule
 ├─ db/         clients Supabase : client (browser) · server (session/RLS) · admin (server-only, service key)
 ├─ food/       Open Food Facts (lookup code-barres, cache)
 └─ photos/     upload bucket privé + URLs signées
supabase/migrations/   schéma SQL versionné (4 migrations : init, cache OFF, exos FR, photos)
scripts/               migrations + seeds (CIQUAL, exercices, storage, traductions)
```

### Le pattern « tools déterministes »

Le cœur du projet : **15 tools** exposés au modèle dans [`lib/ai/tools.ts`](lib/ai/tools.ts).
Chacun valide ses entrées avec **Zod**, puis fait le travail en TypeScript — le modèle
ne voit que le résultat calculé :

| Tool                    | Ce que le **code** garantit                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| `log_meal`              | additionne les macros des aliments (le LLM ne somme jamais)             |
| `log_workout`          | calcule le 1RM estimé de chaque série (moyenne Epley/Brzycki)          |
| `calc_needs`            | BMR (Mifflin-St Jeor) → TDEE → cible calorique → macros (cadre ISSN)   |
| `generate_chart`        | agrège les données réelles par jour et renvoie les points exacts        |
| `search_food`           | recherche plein-texte FR dans CIQUAL (~3 186 aliments, ANSES)           |
| `estimate_1rm`          | 1RM + table de charges %1RM (fiable 1-10 reps)                          |
| `get_history` / `recall_facts` | relecture de l'historique et de la mémoire durable              |
| …                       | `log_weight`, `log_activity`, `remember_fact`, `update_profile`, `search_exercise`, `lookup_barcode`, `get_knowledge` |

### Choix techniques & compromis

- **Claude Haiku 4.5** plutôt qu'un gros modèle : suffisant dès lors que les calculs sont sortis du LLM, et **~10× moins cher**. C'est ce qui rend la cible ~2 €/mois atteignable.
- **Prompt caching** : le préfixe stable (system + fiches ISSN/ANSES) porte un breakpoint de cache Anthropic ; le contexte volatil (date, état des lieux) est placé **après**. Le mode 📝 Info coupe encore les coûts (dernier message seul, tools réduits, réponse ≤ 300 tokens).
- **Sécurité RLS-first** : toutes les tables `user_*` sont filtrées par `user_id = auth.uid()`. Les tools passent par le **client Supabase de la session** → la RLS s'applique d'office. La clé service (`SUPABASE_SECRET_KEY`) reste **server-only** (`lib/db/admin.ts`), jamais côté client. Bucket photos **privé**, sans policy storage : tout passe par le client admin + URLs signées, après vérification d'auth + propriété.
- **Données de référence en local** (CIQUAL, exercices) : pas d'appel API externe payant pour les macros → coût nul et résultats déterministes.
- **AI SDK v7** : les blocs *system* passent par l'option `instructions` de `streamText` (jamais dans `messages`, sous peine de `AI_InvalidPromptError`).

---

## 🚦 État du projet

**Honnêteté avant tout — c'est un projet perso assumé comme tel :**

- ✅ **En production**, utilisé au quotidien : [ia-muscu.vercel.app](https://ia-muscu.vercel.app) (auto-deploy à chaque push sur `main`).
- ✅ Build, lint et `tsc` **verts**. ~41 fichiers source TS/TSX, 4 migrations SQL, 6 scripts.
- 🔒 **Mono-utilisateur par conception** : une garde `ALLOWED_EMAIL` bloque tout autre compte côté API. Le passage multi-utilisateur (quotas, onboarding, isolation renforcée) reste un chantier à part entière.
- ⚠️ **0 test automatisé.** Le point faible réel. Les formules de `lib/calc/` (BMR, TDEE, macros, 1RM) sont pures et déterministes : ce sont les **premières candidates** à une suite de tests unitaires (Vitest), non encore écrite. Aucune CI pour l'instant.
- 🧪 Validation aujourd'hui **manuelle**, en usage réel.

### Chantiers restants

1. **Tests** — Vitest sur `lib/calc/*` (facile, gros gain de confiance), puis sur les tools.
2. **Multi-utilisateur** — débrider la garde `ALLOWED_EMAIL`, quotas de coût par compte, onboarding.
3. **CI** — lint + tsc + tests sur PR.
4. **Observabilité** — suivi du coût IA réel par requête.

---

## 🚀 Lancer en local

> Prérequis : Node 20+, un projet **Supabase**, une clé **Anthropic**.

```bash
npm install
cp .env.example .env.local     # renseigner les variables ci-dessous
npm run dev                    # http://localhost:3000
```

Scripts npm disponibles : `dev`, `build`, `start`, `lint` *(pas de `test` — voir « État »)*.

### Variables d'environnement (`.env.local`)

> ⚠️ Valeurs **non fournies** ici. `.env.local` est gitignoré ; ne jamais committer de secret.

| Variable                        | Rôle                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL du projet Supabase (client)                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique anon Supabase (client)                         |
| `SUPABASE_SECRET_KEY`           | clé service Supabase — **server-only**, jamais côté client  |
| `ANTHROPIC_API_KEY`             | clé API Anthropic (Claude Haiku 4.5)                        |
| `ALLOWED_EMAIL`                 | email autorisé — garde mono-utilisateur                     |
| `SUPABASE_DB_PASSWORD`          | mot de passe DB — **migrations locales uniquement**         |

### Initialiser la base

```bash
node scripts/db-migrate.mjs      # applique les migrations SQL (pooler IPv4 + CA épinglée certs/supabase-ca.pem)
node scripts/setup-storage.mjs   # crée le bucket privé `photos` (idempotent)
node scripts/seed-ciqual.mjs     # importe ~3 186 aliments CIQUAL (ANSES)
node scripts/seed-exercises.mjs  # importe 873 exercices (Free Exercise DB), traduits FR
```

> **WSL / `/mnt/c`** : le cache `.next` se corrompt (`Parsing CSS failed` → `rm -rf .next`) ; tuer le dev server avec `pkill -f "[n]ext dev"` ; redémarrer après une édition serveur (hot-reload peu fiable).

---

## 🧰 Stack

**Next.js 16** (App Router) · **Supabase** (Postgres + RLS, Auth, Storage) · **Vercel AI SDK v7** + `claude-haiku-4-5` · **Tailwind v4** · **Recharts** · **Zod** · PWA · déploiement **Vercel**.

## 📚 Docs internes

- [`PLAN.md`](PLAN.md) — spec complète d'origine (schéma DB, tools, formules, lots P0→P5).
- [`HANDOFF.md`](HANDOFF.md) — changelog de construction et état courant.
- [`CLAUDE.md`](CLAUDE.md) — règles pour l'agent de code.

---

<div align="center">
<sub>

Créé avec soin par <b><a href="https://nathanfernandes.fr">Nathan Fernandes</a></b> — Fondateur de SYNN-IA · Dijon, France

🌐 <a href="https://nathanfernandes.fr">Portfolio</a> · 💼 <a href="https://www.linkedin.com/in/nathan-fernandes-a5793b377/">LinkedIn</a> · 🐙 <a href="https://github.com/SynnIA">GitHub</a>

</sub>
</div>
