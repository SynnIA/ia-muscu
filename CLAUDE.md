# CLAUDE.md — IA-Muscu

## Avant de coder
**Lis `PLAN.md` en entier.** C'est la spec complète (objectif, stack, schéma DB, tools, formules, plan par lots P0→P5). Lis aussi le PDF de recherche à la racine pour les sources de données (CIQUAL, Free Exercise DB, ISSN/ANSES).

## Le projet en 3 lignes
- Webapp perso (mono-utilisateur) de coaching muscu + nutrition. **Pas d'app native**, PWA légère uniquement.
- Stack : Next.js 15 (App Router) + Supabase (Postgres/pgvector/Auth/Storage) + Vercel AI SDK + Recharts.
- Runtime IA : **Claude Haiku 4.5**, cible **≤ 2 €/mois**. Construction par un modèle costaud (toi).

## Règles non négociables
1. **Le LLM parle, le CODE calcule.** Calories, macros, TDEE, 1RM, graphiques = fonctions déterministes en TS exposées comme *tools*. Jamais l'IA.
2. **Coût runtime bas** : Haiku 4.5, prompt caching sur le préfixe stable (system + résumé ISSN/ANSES), réponses courtes par défaut, données de référence en local.
3. **Construire lot par lot** (P0→P5, voir `PLAN.md §10`). Livrer et tester chaque lot avant le suivant. Diff minimal.
4. **Sécurité** : RLS sur toutes les tables `user_*` (`user_id = auth.uid()`) ; `SUPABASE_SERVICE_ROLE_KEY` jamais côté client ; valider les entrées (Zod).
5. **Signaler les risques** avant migration destructive, changement d'auth, ou action irréversible.
6. Au lot **P4 (graphiques)** : invoquer la skill **`dataviz`** avant d'écrire du code de chart.

## Après chaque lot
Proposer les vérifications utiles : lint, build, test ciblé. Mettre à jour un `HANDOFF.md` daté pour la continuité entre sessions.

## Infra
- Supabase : projet perso `zmpwucqbzgylmzixjyqf` (eu-west-1) — HORS org SYNN, donc invisible via MCP. Migrations : `node scripts/db-migrate.mjs` (pooler IPv4 + CA épinglée `certs/`).
- Ne pas réutiliser : `Fitness-SYNN` (mort) ni `IA-Muscu`/qpdsjvpjebgfrmbblgav (doublon en pause, à supprimer).

## État actuel
P0→P5 codés, build+lint verts, DB migrée et seedée (CIQUAL 3186 + 873 exercices). Manque : `ANTHROPIC_API_KEY` dans `.env.local` + test live + rotation du mdp Postgres. Voir `HANDOFF.md`.
