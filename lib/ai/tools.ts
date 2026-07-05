import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  estimate1RM,
  loadForPercent,
  PERCENT_1RM_TABLE,
} from "@/lib/calc/strength";
import {
  ageFromBirthDate,
  bmr,
  calorieTarget,
  macroTargets,
  tdee,
  type Goal,
  type Sex,
} from "@/lib/calc/energy";
import { KNOWLEDGE_TOPICS } from "@/lib/ai/knowledge";
import { lookupBarcode } from "@/lib/food/off";
import { uploadImageDataUrl } from "@/lib/photos/storage";

export type ToolContext = {
  /** Data URL de l'image jointe au message en cours — stockée par log_meal (photo de repas). */
  pendingImage?: string | null;
};

/**
 * Outils exposés au modèle. Le modèle DÉCIDE, le code FAIT :
 * toutes les sommes, 1RM et requêtes sont calculées ici, jamais par le LLM.
 * Le client Supabase est celui de la session utilisateur → RLS appliquée.
 */
export function buildTools(
  supabase: SupabaseClient,
  userId: string,
  ctx: ToolContext = {}
) {
  return {
    log_weight: tool({
      description:
        "Enregistre le poids du jour (et % de masse grasse optionnel). À utiliser dès que l'utilisateur donne son poids.",
      inputSchema: z.object({
        weight_kg: z.number().positive().describe("Poids en kg"),
        body_fat_pct: z.number().min(1).max(70).optional(),
        date: z
          .string()
          .optional()
          .describe("Date ISO YYYY-MM-DD, défaut aujourd'hui"),
        notes: z.string().optional(),
      }),
      execute: async ({ weight_kg, body_fat_pct, date, notes }) => {
        const { error } = await supabase.from("body_metrics").insert({
          user_id: userId,
          weight_kg,
          body_fat_pct: body_fat_pct ?? null,
          ...(date ? { measured_at: date } : {}),
          notes: notes ?? null,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, weight_kg };
      },
    }),

    log_meal: tool({
      description:
        "Enregistre un repas. Fournis chaque aliment avec sa quantité et une estimation de ses macros ; le total est calculé automatiquement.",
      inputSchema: z.object({
        description: z.string().describe("Description courte du repas"),
        eaten_at: z
          .string()
          .optional()
          .describe("Date-heure ISO, défaut maintenant"),
        items: z
          .array(
            z.object({
              food_name: z.string(),
              quantity_g: z.number().positive().optional(),
              kcal: z.number().min(0),
              protein_g: z.number().min(0).optional(),
              carbs_g: z.number().min(0).optional(),
              fat_g: z.number().min(0).optional(),
            })
          )
          .min(1),
      }),
      execute: async ({ description, eaten_at, items }) => {
        // Le CODE fait les totaux — jamais le modèle.
        const sum = (k: "kcal" | "protein_g" | "carbs_g" | "fat_g") =>
          Math.round(items.reduce((acc, it) => acc + (it[k] ?? 0), 0) * 10) / 10;

        const totals = {
          kcal: sum("kcal"),
          protein_g: sum("protein_g"),
          carbs_g: sum("carbs_g"),
          fat_g: sum("fat_g"),
        };

        const { data: meal, error } = await supabase
          .from("meals")
          .insert({
            user_id: userId,
            description,
            ...(eaten_at ? { eaten_at } : {}),
            ...totals,
            source: "estimation",
          })
          .select("id")
          .single();
        if (error || !meal) return { ok: false, error: error?.message };

        const { error: itemsError } = await supabase.from("meal_items").insert(
          items.map((it) => ({
            meal_id: meal.id,
            food_name: it.food_name,
            quantity_g: it.quantity_g ?? null,
            kcal: it.kcal,
            protein_g: it.protein_g ?? null,
            carbs_g: it.carbs_g ?? null,
            fat_g: it.fat_g ?? null,
          }))
        );
        if (itemsError) return { ok: false, error: itemsError.message };

        // Photo jointe au message → conservée (trace visuelle, miniature journal).
        // photo_url contient le PATH storage (bucket privé) — URL signée à l'affichage.
        if (ctx.pendingImage?.startsWith("data:image/")) {
          const path = await uploadImageDataUrl(
            `${userId}/meals/${meal.id}.jpg`,
            ctx.pendingImage
          );
          if (path) {
            await supabase.from("meals").update({ photo_url: path }).eq("id", meal.id);
          }
        }

        return { ok: true, totals };
      },
    }),

    log_workout: tool({
      description:
        "Enregistre une séance de musculation avec ses séries. Le 1RM estimé de chaque série est calculé automatiquement.",
      inputSchema: z.object({
        name: z.string().optional().describe("Nom de la séance, ex. 'Push'"),
        occurred_at: z.string().optional().describe("Date-heure ISO, défaut maintenant"),
        notes: z.string().optional(),
        sets: z
          .array(
            z.object({
              exercise_name: z.string(),
              reps: z.number().int().positive(),
              weight_kg: z.number().min(0),
              rpe: z.number().min(1).max(10).optional(),
            })
          )
          .min(1)
          .describe("Une entrée PAR série (4×8 = 4 entrées)"),
      }),
      execute: async ({ name, occurred_at, notes, sets }) => {
        const { data: workout, error } = await supabase
          .from("workouts")
          .insert({
            user_id: userId,
            name: name ?? null,
            notes: notes ?? null,
            ...(occurred_at ? { occurred_at } : {}),
          })
          .select("id")
          .single();
        if (error || !workout) return { ok: false, error: error?.message };

        const counters = new Map<string, number>();
        const rows = sets.map((s) => {
          const idx = (counters.get(s.exercise_name) ?? 0) + 1;
          counters.set(s.exercise_name, idx);
          return {
            workout_id: workout.id,
            exercise_name: s.exercise_name,
            set_index: idx,
            reps: s.reps,
            weight_kg: s.weight_kg,
            rpe: s.rpe ?? null,
            est_1rm: estimate1RM(s.weight_kg, s.reps), // calculé par le CODE
          };
        });

        const { error: setsError } = await supabase
          .from("workout_sets")
          .insert(rows);
        if (setsError) return { ok: false, error: setsError.message };

        const best = rows.reduce(
          (acc, r) => (r.est_1rm && r.est_1rm > (acc?.est_1rm ?? 0) ? r : acc),
          null as (typeof rows)[number] | null
        );
        return {
          ok: true,
          sets_count: rows.length,
          best_est_1rm: best
            ? { exercise: best.exercise_name, est_1rm: best.est_1rm }
            : null,
        };
      },
    }),

    log_activity: tool({
      description:
        "Enregistre une activité cardio (marche, course, vélo...) manuelle ou issue d'une capture Strava.",
      inputSchema: z.object({
        type: z.string().describe("marche, course, velo, natation..."),
        duration_min: z.number().positive(),
        distance_km: z.number().positive().optional(),
        calories: z.number().positive().optional(),
        occurred_at: z.string().optional().describe("Date-heure ISO, défaut maintenant"),
        source: z.enum(["manuel", "strava"]).default("manuel"),
      }),
      execute: async ({ type, duration_min, distance_km, calories, occurred_at, source }) => {
        const { error } = await supabase.from("activities").insert({
          user_id: userId,
          type,
          duration_min,
          distance_km: distance_km ?? null,
          calories: calories ?? null,
          source,
          ...(occurred_at ? { occurred_at } : {}),
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, type, duration_min };
      },
    }),

    get_history: tool({
      description:
        "Relit l'historique de l'utilisateur (poids, repas, séances, activités, faits mémorisés) sur une période. À utiliser AVANT de proposer un programme ou répondre sur le passé.",
      inputSchema: z.object({
        metric: z.enum(["weight", "meals", "workouts", "activities", "facts"]),
        from: z.string().optional().describe("Date ISO de début"),
        to: z.string().optional().describe("Date ISO de fin"),
        limit: z.number().int().min(1).max(60).default(20),
      }),
      execute: async ({ metric, from, to, limit }) => {
        if (metric === "weight") {
          let q = supabase
            .from("body_metrics")
            .select("measured_at, weight_kg, body_fat_pct, notes")
            .order("measured_at", { ascending: false })
            .limit(limit);
          if (from) q = q.gte("measured_at", from);
          if (to) q = q.lte("measured_at", to);
          const { data, error } = await q;
          return error ? { ok: false, error: error.message } : { ok: true, rows: data };
        }
        if (metric === "meals") {
          let q = supabase
            .from("meals")
            .select("eaten_at, description, kcal, protein_g, carbs_g, fat_g")
            .order("eaten_at", { ascending: false })
            .limit(limit);
          if (from) q = q.gte("eaten_at", from);
          if (to) q = q.lte("eaten_at", to);
          const { data, error } = await q;
          return error ? { ok: false, error: error.message } : { ok: true, rows: data };
        }
        if (metric === "workouts") {
          let q = supabase
            .from("workouts")
            .select(
              "occurred_at, name, notes, workout_sets(exercise_name, set_index, reps, weight_kg, rpe, est_1rm)"
            )
            .order("occurred_at", { ascending: false })
            .limit(limit);
          if (from) q = q.gte("occurred_at", from);
          if (to) q = q.lte("occurred_at", to);
          const { data, error } = await q;
          return error ? { ok: false, error: error.message } : { ok: true, rows: data };
        }
        if (metric === "activities") {
          let q = supabase
            .from("activities")
            .select("occurred_at, type, duration_min, distance_km, calories, source")
            .order("occurred_at", { ascending: false })
            .limit(limit);
          if (from) q = q.gte("occurred_at", from);
          if (to) q = q.lte("occurred_at", to);
          const { data, error } = await q;
          return error ? { ok: false, error: error.message } : { ok: true, rows: data };
        }
        // facts
        const { data, error } = await supabase
          .from("memory_facts")
          .select("fact, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        return error ? { ok: false, error: error.message } : { ok: true, rows: data };
      },
    }),

    remember_fact: tool({
      description:
        "Mémorise un fait durable sur l'utilisateur (objectif, blessure, préférence, allergie, matériel dispo). PAS pour les données déjà loggées (poids, repas, séances).",
      inputSchema: z.object({
        fact: z.string().min(3).describe("Le fait, formulé de façon autonome"),
      }),
      execute: async ({ fact }) => {
        const { error } = await supabase
          .from("memory_facts")
          .insert({ user_id: userId, fact, source: "chat" });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },
    }),

    generate_chart: tool({
      description:
        "Génère un graphique des données réelles de l'utilisateur (affiché directement dans le chat). À utiliser dès qu'il demande une courbe, un graphe ou une évolution.",
      inputSchema: z.object({
        metric: z.enum(["weight", "calories", "protein", "volume", "activity"])
          .describe("weight=poids(kg) · calories=kcal/j · protein=g/j · volume=tonnage/j · activity=min/j"),
        days: z.number().int().min(7).max(365).default(90).describe("Période en jours"),
      }),
      execute: async ({ metric, days }) => {
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        const dayOf = (iso: string) =>
          new Date(iso).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });

        // Le CODE agrège — jamais le modèle.
        const bucket = new Map<string, number>();
        const add = (day: string, v: number) => bucket.set(day, (bucket.get(day) ?? 0) + v);

        if (metric === "weight") {
          const { data, error } = await supabase
            .from("body_metrics")
            .select("measured_at, weight_kg")
            .gte("measured_at", since.slice(0, 10))
            .not("weight_kg", "is", null)
            .order("measured_at", { ascending: true });
          if (error) return { ok: false, error: error.message };
          const points = (data ?? []).map((r) => ({ x: r.measured_at as string, y: Number(r.weight_kg) }));
          if (!points.length) return { ok: false, error: "Aucun poids enregistré sur la période." };
          return { ok: true, metric, title: "Poids", unit: "kg", kind: "line", points };
        }

        if (metric === "calories" || metric === "protein") {
          const col = metric === "calories" ? "kcal" : "protein_g";
          const { data, error } = await supabase
            .from("meals")
            .select(`eaten_at, ${col}`)
            .gte("eaten_at", since);
          if (error) return { ok: false, error: error.message };
          for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
            const v = Number(r[col] ?? 0);
            if (v) add(dayOf(r.eaten_at as string), v);
          }
        } else if (metric === "volume") {
          const { data, error } = await supabase
            .from("workouts")
            .select("occurred_at, workout_sets(reps, weight_kg)")
            .gte("occurred_at", since);
          if (error) return { ok: false, error: error.message };
          for (const w of data ?? []) {
            const day = dayOf(w.occurred_at as string);
            for (const s of w.workout_sets ?? []) {
              add(day, (Number(s.reps) || 0) * (Number(s.weight_kg) || 0));
            }
          }
        } else {
          const { data, error } = await supabase
            .from("activities")
            .select("occurred_at, duration_min")
            .gte("occurred_at", since);
          if (error) return { ok: false, error: error.message };
          for (const r of data ?? []) {
            const v = Number(r.duration_min ?? 0);
            if (v) add(dayOf(r.occurred_at as string), v);
          }
        }

        const points = [...bucket.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([x, y]) => ({ x, y: Math.round(y * 10) / 10 }));
        if (!points.length) return { ok: false, error: "Aucune donnée sur la période." };

        const meta = {
          calories: { title: "Calories", unit: "kcal/j" },
          protein: { title: "Protéines", unit: "g/j" },
          volume: { title: "Volume d'entraînement", unit: "kg soulevés/j" },
          activity: { title: "Activité", unit: "min/j" },
        }[metric];
        return { ok: true, metric, ...meta, kind: "bar", points };
      },
    }),

    update_profile: tool({
      description:
        "Met à jour le profil (taille, date de naissance, sexe, objectif, niveau d'activité). Nécessaire avant calc_needs.",
      inputSchema: z.object({
        height_cm: z.number().min(100).max(250).optional(),
        birth_date: z.string().optional().describe("YYYY-MM-DD"),
        sex: z.enum(["M", "F"]).optional(),
        goal: z.enum(["perte", "maintien", "prise"]).optional(),
        activity_factor: z
          .number()
          .min(1.2)
          .max(1.9)
          .optional()
          .describe("1.2 sédentaire · 1.375 léger · 1.55 modéré · 1.725 très actif · 1.9 extrême"),
        display_name: z.string().optional(),
      }),
      execute: async (input) => {
        const { error } = await supabase
          .from("profiles")
          .upsert({ id: userId, ...input });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },
    }),

    calc_needs: tool({
      description:
        "Calcule BMR, TDEE, cible calorique et macros (Mifflin-St Jeor + cadre ISSN) à partir du profil et du dernier poids enregistré.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("height_cm, birth_date, sex, goal, activity_factor")
          .eq("id", userId)
          .maybeSingle();
        const { data: metric } = await supabase
          .from("body_metrics")
          .select("weight_kg")
          .order("measured_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const missing: string[] = [];
        if (!profile?.height_cm) missing.push("taille");
        if (!profile?.birth_date) missing.push("date de naissance");
        if (!profile?.sex) missing.push("sexe");
        if (!metric?.weight_kg) missing.push("poids (log_weight)");
        if (missing.length) {
          return { ok: false, missing, hint: "Demande ces infos puis update_profile / log_weight." };
        }

        const weight = Number(metric!.weight_kg);
        const bmrKcal = bmr(
          profile!.sex as Sex,
          weight,
          Number(profile!.height_cm),
          ageFromBirthDate(profile!.birth_date as string)
        );
        const tdeeKcal = tdee(bmrKcal, Number(profile!.activity_factor ?? 1.375));
        const goal = (profile!.goal ?? "maintien") as Goal;
        const target = calorieTarget(tdeeKcal, goal);
        return {
          ok: true,
          bmr_kcal: bmrKcal,
          tdee_kcal: tdeeKcal,
          goal,
          kcal_target: target,
          macros: macroTargets(weight, target),
        };
      },
    }),

    estimate_1rm: tool({
      description:
        "Calcule le 1RM estimé (moyenne Epley/Brzycki, fiable 1-10 reps) et la table de charges %1RM.",
      inputSchema: z.object({
        weight_kg: z.number().positive(),
        reps: z.number().int().min(1).max(12),
      }),
      execute: async ({ weight_kg, reps }) => {
        const oneRM = estimate1RM(weight_kg, reps);
        if (!oneRM) return { ok: false, error: "Estimation non fiable (1-12 reps requis)" };
        return {
          ok: true,
          est_1rm: oneRM,
          charges: PERCENT_1RM_TABLE.map((r) => ({
            percent: r.percent,
            reps: r.reps,
            objectif: r.objectif,
            charge_kg: loadForPercent(oneRM, r.percent),
          })),
        };
      },
    }),

    search_food: tool({
      description:
        "Cherche un aliment dans la base CIQUAL (référence française, valeurs pour 100 g). À utiliser pour des macros EXACTES d'aliments bruts/cuisinés.",
      inputSchema: z.object({
        query: z.string().min(2).describe("Nom d'aliment en français, ex. 'poulet rôti'"),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, limit }) => {
        // Recherche plein texte FR, repli sur ILIKE
        const { data: fts } = await supabase
          .from("foods")
          .select("name_fr, kcal_100g, protein_100g, carbs_100g, fat_100g")
          .textSearch("fts", query, { type: "websearch", config: "french" })
          .limit(limit);
        if (fts?.length) return { ok: true, foods: fts };

        const { data: like, error } = await supabase
          .from("foods")
          .select("name_fr, kcal_100g, protein_100g, carbs_100g, fat_100g")
          .ilike("name_fr", `%${query}%`)
          .limit(limit);
        if (error) return { ok: false, error: error.message };
        if (!like?.length) return { ok: false, error: "Aucun aliment trouvé — estime les macros et signale-le." };
        return { ok: true, foods: like };
      },
    }),

    search_exercise: tool({
      description:
        "Cherche des exercices dans la bibliothèque (muscle, équipement, niveau). Recherche en français ou en anglais.",
      inputSchema: z.object({
        name: z.string().optional().describe("Nom FR ou EN, ex. 'développé couché'"),
        muscle: z.string().optional().describe("Muscle principal (anglais), ex. 'chest', 'quadriceps'"),
        equipment: z.string().optional().describe("ex. 'barbell', 'dumbbell', 'body only'"),
        level: z.enum(["beginner", "intermediate", "expert"]).optional(),
        limit: z.number().int().min(1).max(10).default(6),
      }),
      execute: async ({ name, muscle, equipment, level, limit }) => {
        let q = supabase
          .from("exercises")
          .select("name, name_fr, primary_muscles, equipment, level, mechanic, category")
          .limit(limit);
        if (name) q = q.or(`name_fr.ilike.%${name}%,name.ilike.%${name}%`);
        if (muscle) q = q.contains("primary_muscles", [muscle.toLowerCase()]);
        if (equipment) q = q.ilike("equipment", `%${equipment}%`);
        if (level) q = q.eq("level", level);
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        if (!data?.length) return { ok: false, error: "Aucun exercice trouvé" };
        return { ok: true, exercises: data };
      },
    }),

    lookup_barcode: tool({
      description:
        "Recherche un produit emballé par code-barres (Open Food Facts). À utiliser quand l'utilisateur donne un code-barres.",
      inputSchema: z.object({
        barcode: z.string().regex(/^\d{6,14}$/).describe("Code-barres EAN"),
      }),
      execute: async ({ barcode }) => lookupBarcode(supabase, barcode),
    }),

    get_knowledge: tool({
      description:
        "Fiche scientifique détaillée (ISSN/ANSES) sur un sujet : proteines, glucides_timing, seche_prise_masse, creatine, cafeine, reperes_anses, formules.",
      inputSchema: z.object({
        topic: z.enum([
          "proteines",
          "glucides_timing",
          "seche_prise_masse",
          "creatine",
          "cafeine",
          "reperes_anses",
          "formules",
        ]),
      }),
      execute: async ({ topic }) => ({ ok: true, fiche: KNOWLEDGE_TOPICS[topic] }),
    }),

    recall_facts: tool({
      description:
        "Recherche dans les faits mémorisés (objectifs, blessures, préférences...). Utilise un mot-clé simple.",
      inputSchema: z.object({
        query: z.string().optional().describe("Mot-clé ; vide = faits récents"),
      }),
      execute: async ({ query }) => {
        let q = supabase
          .from("memory_facts")
          .select("fact, created_at")
          .order("created_at", { ascending: false })
          .limit(12);
        if (query?.trim()) q = q.ilike("fact", `%${query.trim()}%`);
        const { data, error } = await q;
        return error ? { ok: false, error: error.message } : { ok: true, facts: data };
      },
    }),
  };
}
