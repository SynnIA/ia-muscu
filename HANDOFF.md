# HANDOFF — IA-Muscu (« La Forge »)

## 🚀 PRODUCTION : https://ia-muscu.vercel.app (depuis le 2026-07-05)

## ⚙️ Config Supabase Dashboard à faire par Synnheal (5 min, une fois)
Le projet `zmpwucqbzgylmzixjyqf` est hors org SYNN → inaccessible par l'agent. Dans le Dashboard :
1. **Authentication → URL Configuration** : Site URL = `https://ia-muscu.vercel.app` ; Redirect URLs : ajouter `https://ia-muscu.vercel.app/auth/confirm` (+ `http://localhost:3000/auth/confirm` pour le dev).
2. **Authentication → Emails → Reset Password** : coller `emails/reset-password.html` — sujet : `🔧 Nouveau mot de passe — La Forge`.
3. (Optionnel) **Magic Link / Confirm signup** : coller `emails/magic-link.html` — sujet : `🔥 Ta clé pour entrer dans La Forge` (inutilisé tant que l'auth reste par mot de passe, mais prêt).

## Changelog

### 2026-07-05 (soir, suite) — Refonte UI « identité Forge » (skill ui-ux-pro-max)
- Design system choisi : style athlétique bold, typo display **Barlow Condensed** (next/font, var `--font-barlow`) pour titres/chiffres/wordmark — le lime-400/zinc-950 reste la marque.
- `globals.css` : classes signature — `.forge-bg` (halo braise radial + trame fine), `.display`, `.stat-number` (tabular-nums), `.glow-lime`, `.animate-rise` (entrée cartes), `.press` (enfoncement tactile) — toutes avec `prefers-reduced-motion`.
- Écrans : login = hero de marque (wordmark XL + glow) ; journal = stat tiles gros chiffres + liseré lime + sections uppercase ; tab bar = pilule active + labels condensed ; chat = toggle iconé (NotebookPen/MessageCircleQuestion, plus d'emojis-icônes), empty state avec suggestions tapables (remplissent l'input + basculent le mode), tool chips lime, bulles animées ; photos = header/empty state/bouton Comparer stylés, poignée du comparateur lime avec ChevronsLeftRight ; exos = cartes hover/open lime ; forgot/reset assortis.
- Vérifié : tsc + lint verts, screenshot Playwright mobile 390px du login ✓. Poussé → auto-deploy.

### 2026-07-05 (soir) — Flux « mot de passe oublié » + emails stylés
- **Constat** : auth par mot de passe = aucun email au quotidien, MAIS aucun flux de récupération → mdp oublié = coincé. Corrigé :
  - `/forgot` (public, ajouté aux PUBLIC_PATHS du proxy) : `resetPasswordForEmail` avec redirectTo `/auth/confirm?next=/reset` ; message générique (ne révèle pas si l'email existe).
  - `/auth/confirm` : accepte `?next=` (chemins internes uniquement, anti open-redirect) → redirige vers `/reset` après vérif du token recovery.
  - `/reset` (protégé, session recovery requise) : nouveau mdp ×2, min 8, `updateUser({ password })` → /journal.
  - Lien « Mot de passe oublié ? » sur /login.
- **`emails/reset-password.html`** : template stylé La Forge (fond zinc, carte, bouton lime, wordmark LF), lien pattern SSR `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset`. À coller au dashboard (voir Config ci-dessus) — tant que ce n'est pas fait, l'email de reset partira avec le template Supabase par défaut (moche mais fonctionnel une fois Site URL configurée… en fait NON : sans template collé, le lien par défaut {{ .ConfirmationURL }} redirige vers Site URL — configurer la Site URL est le vrai prérequis).
- Vérif modèles IA (question Synnheal) : `claude-haiku-4-5` partout (chat runtime + script de traduction one-shot), aucun autre modèle. ✅ ≤ 2 €/mois tenu.

### 2026-07-05 (fin de session) — EN LIGNE + dernières features
- **Fix bloquant AI SDK v7** : les blocs system dans `messages` sont interdits (AI_InvalidPromptError) → migrés vers l'option `instructions` (array de SystemModelMessage, cache breakpoint conservé). Tous les appels IA étaient morts avant ce fix. Au passage : `streamHasError()` (lib/ui-stream.ts) pour ne plus afficher de faux « Enregistré ✓ » quand le flux contient une erreur (quick-add + comparateur).
- **« Vue sur tout » du coach** (demande Synnheal : « il voit TOUT sur 3-4 mois ») : `lib/ai/summary.ts` → état des lieux chiffré calculé par le code (poids 120 j : départ/actuel/delta/kg-par-semaine, moyennes kcal+prot 30 j, séances/sem + progression 1RM par exo 90 j — première vs dernière séance, cardio 30 j, photos, objectif, faits), injecté dans le bloc system volatil à CHAQUE message en mode Question (~500 tokens ≈ 0,3 €/mois). Le prompt dit au coach de s'appuyer dessus d'office.
- **Mini-calendrier journal** : tap sur la date du header → grille du mois (points lime = jours avec données, ‹ › entre mois, 100 % serveur, param `?cal=1`). `components/journal/month-calendar.tsx`.
- **Pagination exos** : bouton « Afficher plus » (+40, max 400, param `?n=`).
- **Git/GitHub** : ⚠️ le dossier n'avait PAS de repo propre (le « repo » vu par git = `/mnt/c/Users/Synnheal` entier avec `.gitignore: *`). → `git init -b main` dans le projet, 2 commits, **repo privé https://github.com/SynnIA/ia-muscu** (compte gh : SynnIA). `.gitignore` : `.env*` exclu, `!certs/supabase-ca.pem` forcé (CA publique requise par db-migrate), `/logs/` exclu.
- **Vercel** : projet `ia-muscu` (compte synnheal-5649 / synnheals-projects), **connecté au repo GitHub → auto-deploy sur push main**. 5 env vars production posées via CLI (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY, ALLOWED_EMAIL — SUPABASE_DB_PASSWORD volontairement PAS envoyée, migrations = local only). Build prod 51 s, Ready. Smoke : /login 200, /api/chat 401 sans auth, manifest 200. Pas de config Supabase URL nécessaire (auth = signInWithPassword, zéro redirect email).
- **Décisions dernière salve de questions** : pas de notifications push, pas d'offline (PWA online-only), mini-calendrier oui, GitHub+Vercel oui.
- **Reste (optionnel, non bloquant)** : test complet en prod par Synnheal (login, Info/Question, photos, comparateur) ; installer la PWA sur le tel (Safari/Chrome → Ajouter à l'écran d'accueil sur https://ia-muscu.vercel.app) ; ⚠️ piège dev WSL : cache `.next` corrompu sur /mnt/c → `rm -rf .next` si « Parsing CSS failed ».

### 2026-07-05 (suite) — P6a+P6b+P6c IMPLÉMENTÉS (même session)
- **P6a Mode Info/Question** :
  - `/api/chat` accepte `mode: "info" | "question"` (défaut question). Mode info = `INFO_PROMPT` minimal (lib/ai/prompt.ts), **dernier message user uniquement** (pas d'historique), 7 tools seulement (log_*, remember_fact, search_food, lookup_barcode), maxOutputTokens 300. Cache breakpoint conservé sur les deux prompts (2 entrées de cache distinctes).
  - `SYSTEM_PROMPT` refondu : pote de salle motivant, coaching semi-guidé, nutrition suivi souple.
  - `chat.tsx` : toggle segmenté 📝 Info / 💬 Question au-dessus du composer (persisté `ia-muscu:mode`, défaut info), placeholder dynamique, `sendMessage(..., { body: { mode } })`.
  - `quick-add.tsx` (journal) envoie `mode: "info"`.
- **P6b Photos physique** :
  - Migration `0004_progress_photos.sql` appliquée (table + RLS). Bucket Storage **privé** `photos` créé via `scripts/setup-storage.mjs` (idempotent). **Aucune policy storage** : tout passe par le client admin server-only (`lib/photos/storage.ts` : upload data URL, signed URLs 1-6 h, delete) — les routes vérifient auth + propriété via RLS d'abord.
  - `/api/photos` : POST (data URL + pose + date, Zod) / DELETE (?id=, lecture RLS avant suppression storage).
  - Onglet **📸 /photos** (tab bar → 4 onglets) : upload avec chips pose face/profil/dos + date, galerie groupée par date (vignettes 3/4, badge pose), sélection 2 photos → **comparateur avant/après** (`compare-slider.tsx`, clip-path + pointer events), suppression (sélection 1 + confirm).
  - **Avis du coach** dans le comparateur : fetch des 2 signed URLs → data URL 1024px → POST /api/chat mode question (vision, à la demande seulement). Réponse affichée dans l'overlay + persistée dans le fil.
- **P6c Photos de repas persistées** :
  - `/api/chat` extrait l'image du dernier message → `buildTools(supabase, uid, { pendingImage })` ; `log_meal` uploade dans `photos/<uid>/meals/<mealId>.jpg` et renseigne `meals.photo_url` (= PATH storage, pas une URL).
  - Journal : miniatures 48px (signed URLs) sur les repas.
- Refactor léger : `lib/images.ts` (resizeToDataUrl partagé), `lib/ui-stream.ts` (extractStreamText partagé quick-add + comparateur).
- Reste à tester live (Synnheal) : toggle Info/Question, upload photos physique, comparateur, avis coach, photo repas → miniature journal.

### 2026-07-05 — Session spec produit (questions/réponses avec Synnheal, rien codé)

**Décisions produit actées :**
- **Mode Info / Question** : toggle dans le chat au-dessus du champ de saisie.
  - *Info* = logger vite (« je vais marcher 2h », séance écrite…) → prompt IA **minimal** (pas d'historique de conversation, pas de prompt coach complet, juste extraction + tools log_*), réponse = **une phrase courte de l'IA avec personnalité**. Coût cible ~0,001 $/log.
  - *Question* = vrai coach (historique, mémoire, connaissances, réponses complètes).
  - La saisie directe du journal existante bascule sur le mode Info (même endpoint léger).
- **Coach** : programme **semi-guidé** (pas de split figé — propose une séance à la demande selon historique/récupération), nutrition **suivi souple** (tendance hebdo, pas de reproche par repas), ton **« pote de salle motivant »** (tutoiement, énergie, un peu de chambre).
- **Photos physique** : nouvel onglet **📸 /photos** (tab bar → 4 onglets). Photos taguées **par pose (face/profil/dos)**, datées, bucket privé Supabase Storage. **Comparateur avant/après** : sélection de 2 dates → slider draggable au milieu qui révèle l'une ou l'autre photo. 100 % code. Le coach peut regarder/comparer les photos **à la demande uniquement** (vision, ~1 ct/comparaison).
- **Photos repas** : désormais **stockées** (Storage) et affichées dans le journal — mais les bilans lisent les **données** (`meals`), jamais re-analyser les photos en masse.
- **Bilans** (« j'ai bien mangé ce mois-ci ? ») : **à la demande seulement**, pas de génération automatique.
- Ordre de travail choisi : **nouvelles features d'abord**, puis test live complet, puis déploiement Vercel.
- ⚠️ Deux choix faits par défaut (Synnheal AFK sur la dernière question, à reconfirmer) : onglet Photos dédié (vs page « Progression » avec graphiques) ; coach autorisé sur les photos physique à la demande.

**Plan des prochains lots :**
1. **P6a — Toggle Info/Question** : endpoint léger (ou branche dans /api/chat), prompt minimal mode Info, phrase courte IA, ton « pote de salle » dans le prompt coach, brancher la saisie journal dessus.
2. **P6b — Photos physique** : migration table `progress_photos` (user_id, taken_at, pose, photo_url), bucket privé + policies Storage, onglet /photos (galerie + upload + tags pose), comparateur slider, tool coach « compare mes photos ».
3. **P6c — Photos repas persistées** : upload Storage au log_meal photo, `meals.photo_url` renseigné, miniatures dans le journal.
4. Ensuite : test live navigateur complet → déploiement Vercel → commit git (~60 fichiers en attente).

### 2026-07-02 (suite 2) — Auth basculée en email + mot de passe
- **Magic link ABANDONNÉ** (rate limits Supabase + SMTP custom requis = flemme assumée). Remplacé par :
  - **`/setup`** (public, one-shot) : crée LE compte `ALLOWED_EMAIL` **pré-confirmé** via `auth.admin.createUser` (clé secrète, server action) → **aucun email envoyé, aucune config dashboard**. La page se verrouille dès que le compte existe.
  - **`/login`** : email + mot de passe (`signInWithPassword`), messages FR, lien vers /setup.
  - `lib/db/admin.ts` (client admin server-only, package `server-only` installé). `/auth/confirm` conservé mais plus utilisé.
- Le template email `emails/magic-link.html` (design La Forge) reste dispo si un jour SMTP custom → réutilisable pour "Confirm signup"/"Magic Link".
- Passe responsive mobile : 16px anti-zoom iOS sur tous les champs, touch targets 44px, safe-areas haut/bas, header date sticky+blur, overscroll contenu, touch-action manipulation.
- Fix bug bloquant : `parisDayRange` (« Invalid time value ») — parsing d'heure fr-FR remplacé par `formatToParts` shortOffset. Testé été/hiver.
- Exos : 873 avec **images** (raw.githubusercontent) + traduction FR par lots Haiku (`scripts/translate-exercises.mjs`, reprise auto) — colonnes `name_fr`/`instructions_fr` (migration 0003). Recherche FR+EN (page + tool search_exercise).

### 2026-07-02 (suite) — Refonte UI pendant le test live
- **Nom de l'app choisi : « La Forge »** (layout, manifest, login, header chat).
- **Refonte demandée par Synnheal mi-test** : le chat seul ne convenait pas. Nouvelle structure en 3 onglets (tab bar mobile en bas) :
  - **📅 /journal (accueil)** : vue par jour — navigation ‹ › par date, 4 tuiles de totaux (kcal, protéines, volume, cardio — calculés par le code), sections Poids/Séances (séries agrégées par exo + 1RM)/Repas (macros + source)/Activités, **saisie directe** (champ texte → même endpoint /api/chat → mêmes tools → refresh). Préfixe `[Saisie journal du YYYY-MM-DD]` pour dater correctement.
  - **💬 /chat (« Coach »)** : l'écran chat existant, inchangé (photos, voix, graphiques).
  - **🏋️ /exercises (« Exos »)** : bibliothèque des 873 exercices, recherche + filtres muscle/matériel (labels FR, noms d'exos EN), instructions dépliables.
- Routes : `/` → /journal ; manifest start_url → /journal. Groupe `app/(tabs)/` + `components/nav/tab-bar.tsx`, `lib/dates.ts` (fuseau Paris).
- ⚠️ Piège WSL récurrent : `pkill -f "next dev"` se tue lui-même (le motif matche sa propre cmdline) → utiliser `pkill -f "[n]ext dev"`. Hot-reload peu fiable sur /mnt/c (inotify drvfs) → redémarrer le serveur après édition.
- Reste refonte : vue "calendrier mois" éventuelle (actuel = jour par jour), images d'exercices non importées (colonne absente), pagination exos (40 max affichés).

### 2026-07-02 — Construction P0→P5 (session Fable 5)

**État : tout le code est écrit, build + lint verts. Il manque UNIQUEMENT la clé Anthropic pour que le chat réponde.**

#### Fait
- **P0 Fondations** : Next.js 16 (App Router, TS, Tailwind v4), PWA (manifest + icônes haltère générées), auth Supabase magic link (`@supabase/ssr`, `proxy.ts` = middleware Next 16), garde mono-utilisateur (`ALLOWED_EMAIL`), chat streaming Vercel AI SDK v6 → `claude-haiku-4-5`.
- **P1 Mémoire** : schéma complet appliqué sur la DB (11 tables + RLS + pgvector, voir `supabase/migrations/`), 8 tools de base (log_weight/meal/workout/activity, get_history, remember/recall_facts), persistance des conversations dans `messages`, historique rechargé au démarrage.
- **P2 Vision** : upload photo dans le chat (redimensionnée client 1280px JPEG → coût maîtrisé), le modèle lit l'image (repas → log_meal, capture Strava → log_activity source strava). Photos éphémères, non stockées.
- **P3 Socle** : **3 186 aliments CIQUAL** importés (FTS français) + **873 exercices** Free Exercise DB ; `lib/calc/energy.ts` (Mifflin-St Jeor/TDEE/macros) + `strength.ts` (Epley/Brzycki/%1RM) ; tools update_profile, calc_needs, estimate_1rm, search_food, search_exercise, lookup_barcode (Open Food Facts + cache `off_cache`), get_knowledge (fiches ISSN/ANSES statiques) ; **prompt caching** posé (bloc system stable + cache_control, date dans un 2e bloc après le cache).
- **P4 Graphiques** : tool `generate_chart` (agrégation par le code : weight/calories/protein/volume/activity) + `ChartRenderer` Recharts rendu inline dans le chat. Couleur de marque `#65a30d` **validée** par le script de la skill dataviz (mode sombre). Vue tableau accessible sous chaque graphe.
- **P5 Voix** : dictée micro (Web Speech, fr-FR, bouton masqué si non supporté) + lecture vocale des réponses (toggle 🔊 dans le header, persisté localStorage). Gratuit, zéro IA payante.

#### Infra
- **Supabase** : projet perso de Synnheal `zmpwucqbzgylmzixjyqf` (région **eu-west-1**), PAS dans l'org SYNN → invisible via l'intégration MCP ; les migrations passent par `scripts/db-migrate.mjs` (pooler IPv4 `aws-0-eu-west-1.pooler.supabase.com:5432`, CA Supabase épinglée dans `certs/supabase-ca.pem`, IPv6 indisponible en WSL2).
- Migrations appliquées : `0001_init.sql`, `0002_off_cache.sql` (suivi dans la table `_migrations`).
- Seeds : `scripts/seed-exercises.mjs` (fait), `scripts/seed-ciqual.mjs` (fait — URL officielle ANSES .xls ; ⚠️ mapping fibres corrigé le 2026-07-02).
- Projet Supabase `IA-Muscu` (`qpdsjvpjebgfrmbblgav`, org SYNN, créé par erreur de doublon) → **mis en pause**, à supprimer du dashboard.
- L'ancien `Fitness-SYNN` est mort (pause > 90 j, non restaurable).

#### Reste à faire (par ordre)
1. ~~Clé Anthropic~~ ✅ 2026-07-02 : clé ajoutée et **validée** (HTTP 200 sur count_tokens). Mdp Postgres **roté par Synnheal** et revalidé via pooler ; clés Supabase revalidées. Smoke test local OK : `/`→307 login, `/login` 200, manifest 200, `/api/chat` sans auth → **401** (fix proxy du même jour).
2. **Test live navigateur** (à faire par Synnheal) : `npm run dev` → login magic link (synnheal@gmail.com) → tester messages, photo repas, capture Strava, « graphe mon poids », voix 🔊/🎤.
3. Déploiement Vercel : `vercel` + env vars + ajouter l'URL de prod dans Supabase (Auth → URL Configuration → Site URL + Redirect URLs `…/auth/confirm`).
4. Git : ~60 fichiers non commités — commiter dès validation.
5. Optionnel (reliquat P5) : service worker offline, notifications de rappel, traduction FR des noms d'exercices (`name_fr` null pour l'instant — le modèle traduit à la volée), embeddings gte-small pour `memory_facts` (colonne vector(384) prête ; recherche ILIKE en attendant, suffisant mono-user).

#### Décisions notables
- RAG « lourd » (pgvector+embeddings) remplacé par fiches statiques `lib/ai/knowledge.ts` + résumé dans le prompt : gratuit, déterministe, suffisant pour 1 user. pgvector reste en place si besoin plus tard.
- Pas de clé service_role utilisée : tous les tools passent par la session utilisateur (RLS) — plus sûr.
- `meals.source` : 'estimation' (P1) vs 'ciqual'/'off' (P3) pour tracer la fiabilité des macros.
