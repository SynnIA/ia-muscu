import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ÉTAT DES LIEUX chiffré injecté au coach (mode Question uniquement) :
 * la « vue sur tout » longue durée, calculée par le CODE — jamais par l'IA.
 * ~400-600 tokens, dans le bloc system volatil (après le point de cache).
 */

const DAY_MS = 86_400_000;

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
}

export async function buildUserSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const since120 = new Date(Date.now() - 120 * DAY_MS).toISOString();
  const since90 = new Date(Date.now() - 90 * DAY_MS).toISOString();
  const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [profileQ, weightsQ, mealsQ, workoutsQ, activitiesQ, factsQ, photosQ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("goal, height_cm, birth_date, activity_factor")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("body_metrics")
        .select("measured_at, weight_kg")
        .gte("measured_at", since120.slice(0, 10))
        .not("weight_kg", "is", null)
        .order("measured_at", { ascending: true }),
      supabase
        .from("meals")
        .select("eaten_at, kcal, protein_g")
        .gte("eaten_at", since30),
      supabase
        .from("workouts")
        .select("occurred_at, workout_sets(exercise_name, reps, weight_kg, est_1rm)")
        .gte("occurred_at", since90)
        .order("occurred_at", { ascending: true }),
      supabase
        .from("activities")
        .select("occurred_at, type, duration_min")
        .gte("occurred_at", since30),
      supabase
        .from("memory_facts")
        .select("fact")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("progress_photos")
        .select("taken_at")
        .order("taken_at", { ascending: false })
        .limit(30),
    ]);

  const lines: string[] = ["# État des lieux (calculé par le code — fiable)"];

  // Poids — évolution longue durée
  const weights = weightsQ.data ?? [];
  if (weights.length >= 2) {
    const first = weights[0];
    const last = weights[weights.length - 1];
    const delta = r1(Number(last.weight_kg) - Number(first.weight_kg));
    const spanDays = Math.max(
      1,
      Math.round(
        (new Date(last.measured_at).getTime() - new Date(first.measured_at).getTime()) /
          DAY_MS
      )
    );
    const perWeek = r1((delta / spanDays) * 7);
    lines.push(
      `Poids : ${first.weight_kg} kg (${fmtDay(first.measured_at)}) → ${last.weight_kg} kg (${fmtDay(last.measured_at)}) soit ${delta > 0 ? "+" : ""}${delta} kg en ${spanDays} j (${perWeek > 0 ? "+" : ""}${perWeek} kg/sem). ${weights.length} pesées sur 4 mois.`
    );
  } else if (weights.length === 1) {
    lines.push(`Poids : ${weights[0].weight_kg} kg (${fmtDay(weights[0].measured_at)}) — une seule pesée, encourage un suivi régulier.`);
  } else {
    lines.push("Poids : aucune pesée enregistrée sur 4 mois.");
  }

  // Nutrition — moyennes 30 j sur les jours réellement loggés
  const meals = mealsQ.data ?? [];
  if (meals.length) {
    const byDay = new Map<string, { kcal: number; prot: number }>();
    for (const m of meals) {
      const d = new Date(m.eaten_at).toLocaleDateString("fr-CA", {
        timeZone: "Europe/Paris",
      });
      const acc = byDay.get(d) ?? { kcal: 0, prot: 0 };
      acc.kcal += Number(m.kcal ?? 0);
      acc.prot += Number(m.protein_g ?? 0);
      byDay.set(d, acc);
    }
    const days = [...byDay.values()];
    const avgK = Math.round(days.reduce((a, d) => a + d.kcal, 0) / days.length);
    const avgP = Math.round(days.reduce((a, d) => a + d.prot, 0) / days.length);
    lines.push(
      `Nutrition (30 j) : ${days.length} jours loggés, moyenne ${avgK} kcal et ${avgP} g de protéines par jour loggé.`
    );
  } else {
    lines.push("Nutrition : aucun repas loggé sur 30 j.");
  }

  // Entraînement — fréquence + progression 1RM par exo (90 j)
  const workouts = workoutsQ.data ?? [];
  if (workouts.length) {
    const spanDays = Math.max(
      7,
      Math.round(
        (Date.now() - new Date(workouts[0].occurred_at).getTime()) / DAY_MS
      )
    );
    const perWeek = r1((workouts.length / spanDays) * 7);
    lines.push(`Muscu (90 j) : ${workouts.length} séances (~${perWeek}/sem).`);

    // Progression 1RM par exercice : meilleur 1RM de la PREMIÈRE séance vs celui
    // de la DERNIÈRE séance où l'exo apparaît (workouts triés chronologiquement)
    const byExo = new Map<
      string,
      { firstIdx: number; firstRm: number; lastIdx: number; lastRm: number; count: number }
    >();
    workouts.forEach((w, wi) => {
      for (const s of w.workout_sets ?? []) {
        const rm = Number(s.est_1rm ?? 0);
        if (!rm) continue;
        const e = byExo.get(s.exercise_name);
        if (!e) {
          byExo.set(s.exercise_name, {
            firstIdx: wi,
            firstRm: rm,
            lastIdx: wi,
            lastRm: rm,
            count: 1,
          });
        } else {
          if (wi === e.firstIdx) e.firstRm = Math.max(e.firstRm, rm);
          if (wi > e.lastIdx) {
            e.lastIdx = wi;
            e.lastRm = rm;
          } else if (wi === e.lastIdx) {
            e.lastRm = Math.max(e.lastRm, rm);
          }
          e.count++;
        }
      }
    });
    const top = [...byExo.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, e]) => {
        const d = r1(e.lastRm - e.firstRm);
        return `${name} 1RM ${e.firstRm}→${e.lastRm} kg (${d >= 0 ? "+" : ""}${d})`;
      });
    if (top.length) lines.push(`Progression : ${top.join(" · ")}.`);
  } else {
    lines.push("Muscu : aucune séance loggée sur 90 j.");
  }

  // Cardio 30 j
  const acts = activitiesQ.data ?? [];
  if (acts.length) {
    const totMin = Math.round(acts.reduce((a, x) => a + Number(x.duration_min ?? 0), 0));
    lines.push(`Cardio (30 j) : ${acts.length} activités, ${totMin} min au total.`);
  }

  // Photos physique
  const photos = photosQ.data ?? [];
  if (photos.length) {
    lines.push(
      `Photos physique : ${photos.length} récentes, dernière le ${fmtDay(photos[0].taken_at)} (comparateur avant/après dans l'onglet Photos).`
    );
  }

  // Profil + faits durables
  const p = profileQ.data;
  if (p?.goal) lines.push(`Objectif déclaré : ${p.goal}.`);
  const facts = (factsQ.data ?? []).map((f) => f.fact);
  if (facts.length) lines.push(`À retenir : ${facts.join(" | ")}`);

  return lines.join("\n");
}
