<div align="center">

# 🔥 La Forge

### AI training & nutrition coach — *the LLM talks, the code calculates.*

**English** · [🇫🇷 Français](README.fr.md)

[![In prod](https://img.shields.io/badge/status-in%20prod-FF3D00?style=flat-square)](https://ia-muscu.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-v7-000000?style=flat-square&logo=vercel&logoColor=white)](https://sdk.vercel.ai)
[![Claude Haiku 4.5](https://img.shields.io/badge/Claude-Haiku%204.5-D97757?style=flat-square&logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

**▶ Live: [ia-muscu.vercel.app](https://ia-muscu.vercel.app)**

A single-user PWA that logs workouts and nutrition in natural language,
reads photos (meals, physique, activity screenshots) and tracks progress
over months — for **~€2/month** of AI.

</div>

---

## 📖 The story

I wanted a training & nutrition coach that would actually follow me: remember my
sessions, compute my needs, read a photo of my plate and tell me where I stand.
Market apps are either glorified spreadsheets or €10–20/month subscriptions.
Goal: **build it myself for the price of one coffee a month.**

Except that when you ask an LLM "how many calories in this meal" or "what's my 1RM",
it **invents plausible-but-wrong numbers**. It adds badly, rounds randomly,
"hallucinates" a TDEE. Unacceptable for a tracking tool where the number *is* the product.

Hence the principle that structures the whole project:

> ### 🗣️ The LLM talks. 🧮 The code calculates.
>
> The model understands natural language, decides **what** to do and writes the answer.
> But every number — calories, macros, TDEE, 1RM, volume, chart points — comes from a
> **deterministic, hand-testable TypeScript function**, exposed to the model as a *tool*.
> The AI never performs an addition that matters.

Result: the conversation is fluid *and* the numbers are exact and reproducible.

---

## ✨ What it does

- **📅 Journal** — day view: kcal / protein / volume / cardio totals **computed by code**, quick natural-language logging, mini month calendar, meal-photo thumbnails.
- **💬 Coach** — two-mode chat:
  - **📝 Info** — lightning log ("4×8 squat at 80 kg"): minimal prompt, reduced toolset, one-sentence reply. ~$0.001 per log.
  - **💬 Question** — full coach (your "gym buddy"), with a **4-month numeric status report** (weight, nutrition averages, 1RM progression…) recomputed by code and injected into every message.
  - **Vision**: meal photo → CIQUAL macros; activity screenshot → cardio session.
  - **Inline Recharts charts** generated on demand, from real data.
  - **Voice**: dictation + read-aloud (Web Speech API, free).
- **🏋️ Exercises** — 873 exercises (Free Exercise DB) translated to French, muscle / equipment / level filters, images.
- **📸 Photos** — physique shots by pose (front / side / back), **before/after slider comparator**, coach feedback on demand. Private Supabase bucket, signed URLs.

---

## 🧱 Under the hood

### Architecture

```
app/            Next.js App Router — tabs (journal, chat, exercises, photos), auth, API routes
components/     React UI (chat, Recharts charts, photo comparator, nav…)
lib/
 ├─ ai/         prompt (cacheable prefix) · summary (4-month status) · tools · knowledge (ISSN/ANSES sheets)
 ├─ calc/       energy.ts (BMR Mifflin-St Jeor, TDEE, macros) · strength.ts (1RM Epley/Brzycki, %1RM table)  ← the CODE calculates
 ├─ db/         Supabase clients: client (browser) · server (session/RLS) · admin (server-only, service key)
 ├─ food/       Open Food Facts (barcode lookup, cache)
 └─ photos/     private-bucket upload + signed URLs
supabase/migrations/   versioned SQL schema (4 migrations: init, OFF cache, FR exercises, photos)
scripts/               migrations + seeds (CIQUAL, exercises, storage, translations)
```

### The "deterministic tools" pattern

The heart of the project: **15 tools** exposed to the model in [`lib/ai/tools.ts`](lib/ai/tools.ts).
Each validates its inputs with **Zod**, then does the work in TypeScript — the model
only ever sees the computed result:

| Tool                    | What the **code** guarantees                                            |
| ----------------------- | ----------------------------------------------------------------------- |
| `log_meal`              | sums the food macros (the LLM never adds)                               |
| `log_workout`          | computes the estimated 1RM of every set (Epley/Brzycki average)         |
| `calc_needs`            | BMR (Mifflin-St Jeor) → TDEE → calorie target → macros (ISSN framework) |
| `generate_chart`        | aggregates real data by day and returns exact points                    |
| `search_food`           | FR full-text search in CIQUAL (~3,186 foods, ANSES)                     |
| `estimate_1rm`          | 1RM + %1RM load table (reliable 1–10 reps)                              |
| `get_history` / `recall_facts` | history and durable-memory reads                                 |
| …                       | `log_weight`, `log_activity`, `remember_fact`, `update_profile`, `search_exercise`, `lookup_barcode`, `get_knowledge` |

### Technical choices & trade-offs

- **Claude Haiku 4.5** instead of a big model: sufficient once calculations are outside the LLM, and **~10× cheaper**. That's what makes the ~€2/month target reachable.
- **Prompt caching**: the stable prefix (system + ISSN/ANSES sheets) carries an Anthropic cache breakpoint; volatile context (date, status report) goes **after** it. 📝 Info mode cuts costs further (last message only, reduced tools, ≤300-token replies).
- **RLS-first security**: every `user_*` table is filtered by `user_id = auth.uid()`. Tools go through the **session Supabase client** → RLS applies by default. The service key (`SUPABASE_SECRET_KEY`) stays **server-only** (`lib/db/admin.ts`), never client-side. **Private** photo bucket with no storage policy: everything goes through the admin client + signed URLs, after auth + ownership checks.
- **Reference data stored locally** (CIQUAL, exercises): no paid external API calls for macros → zero cost and deterministic results.
- **AI SDK v7**: *system* blocks go through `streamText`'s `instructions` option (never in `messages`, on pain of `AI_InvalidPromptError`).

---

## 🚦 Project status

**Honesty first — this is a personal project and owns it:**

- ✅ **In production**, used daily: [ia-muscu.vercel.app](https://ia-muscu.vercel.app) (auto-deploy on every push to `main`).
- ✅ Build, lint and `tsc` **green**. ~41 TS/TSX source files, 4 SQL migrations, 6 scripts.
- 🔒 **Single-user by design**: an `ALLOWED_EMAIL` guard blocks any other account at the API level. Going multi-user (quotas, onboarding, hardened isolation) is a whole project of its own.
- ⚠️ **0 automated tests.** The real weak point. The `lib/calc/` formulas (BMR, TDEE, macros, 1RM) are pure and deterministic: they are the **first candidates** for a unit-test suite (Vitest), not yet written. No CI for now.
- 🧪 Validation is currently **manual**, through real-world use.

### Remaining work

1. **Tests** — Vitest on `lib/calc/*` (easy, big confidence gain), then on the tools.
2. **Multi-user** — lift the `ALLOWED_EMAIL` guard, per-account cost quotas, onboarding.
3. **CI** — lint + tsc + tests on PR.
4. **Observability** — real AI cost tracking per request.

---

## 🚀 Run locally

> Prerequisites: Node 20+, a **Supabase** project, an **Anthropic** key.

```bash
npm install
cp .env.example .env.local     # fill in the variables below
npm run dev                    # http://localhost:3000
```

Available npm scripts: `dev`, `build`, `start`, `lint` *(no `test` — see "Status")*.

### Environment variables (`.env.local`)

> ⚠️ Values **not provided** here. `.env.local` is gitignored; never commit a secret.

| Variable                        | Role                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL (client)                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key (client)                           |
| `SUPABASE_SECRET_KEY`           | Supabase service key — **server-only**, never client-side   |
| `ANTHROPIC_API_KEY`             | Anthropic API key (Claude Haiku 4.5)                        |
| `ALLOWED_EMAIL`                 | allowed email — single-user guard                           |
| `SUPABASE_DB_PASSWORD`          | DB password — **local migrations only**                     |

### Initialise the database

```bash
node scripts/db-migrate.mjs      # applies SQL migrations (IPv4 pooler + pinned CA certs/supabase-ca.pem)
node scripts/setup-storage.mjs   # creates the private `photos` bucket (idempotent)
node scripts/seed-ciqual.mjs     # imports ~3,186 CIQUAL foods (ANSES)
node scripts/seed-exercises.mjs  # imports 873 exercises (Free Exercise DB), FR-translated
```

> **WSL / `/mnt/c`**: the `.next` cache gets corrupted (`Parsing CSS failed` → `rm -rf .next`); kill the dev server with `pkill -f "[n]ext dev"`; restart after a server-side edit (hot-reload unreliable).

---

## 🧰 Stack

**Next.js 16** (App Router) · **Supabase** (Postgres + RLS, Auth, Storage) · **Vercel AI SDK v7** + `claude-haiku-4-5` · **Tailwind v4** · **Recharts** · **Zod** · PWA · deployed on **Vercel**.

## 📚 Internal docs

- [`PLAN.md`](PLAN.md) — original full spec (DB schema, tools, formulas, P0→P5 batches).
- [`HANDOFF.md`](HANDOFF.md) — build changelog and current state.
- [`CLAUDE.md`](CLAUDE.md) — rules for the coding agent.

---

<div align="center">
<sub>

Built with care by <b><a href="https://nathanfernandes.fr">Nathan Fernandes</a></b> — Founder of SYNN-IA · Dijon, France

🌐 <a href="https://nathanfernandes.fr">Portfolio</a> · 💼 <a href="https://www.linkedin.com/in/nathan-fernandes-a5793b377/">LinkedIn</a> · 🐙 <a href="https://github.com/SynnIA">GitHub</a>

</sub>
</div>
