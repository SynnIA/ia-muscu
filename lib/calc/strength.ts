/**
 * Formules de force — déterministes, JAMAIS déléguées au LLM.
 * Fiables pour 1 à 10 reps (les deux formules divergent au-delà).
 */

/** 1RM estimé — formule d'Epley : poids × (1 + reps/30) */
export function epley1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/** 1RM estimé — formule de Brzycki : poids / (1.0278 − 0.0278 × reps) */
export function brzycki1RM(weightKg: number, reps: number): number {
  return weightKg / (1.0278 - 0.0278 * reps);
}

/**
 * 1RM estimé recommandé : moyenne Epley/Brzycki.
 * Retourne null si les données ne permettent pas une estimation fiable.
 */
export function estimate1RM(weightKg: number, reps: number): number | null {
  if (!weightKg || weightKg <= 0 || !reps || reps < 1 || reps > 12) return null;
  if (reps === 1) return round1(weightKg);
  const avg = (epley1RM(weightKg, reps) + brzycki1RM(weightKg, reps)) / 2;
  return round1(avg);
}

/** Table %1RM → répétitions cibles (prescription de charges). */
export const PERCENT_1RM_TABLE = [
  { percent: 100, reps: 1, objectif: "force max" },
  { percent: 95, reps: 2, objectif: "force" },
  { percent: 90, reps: 3, objectif: "force" },
  { percent: 85, reps: 5, objectif: "force" },
  { percent: 80, reps: 8, objectif: "hypertrophie" },
  { percent: 75, reps: 10, objectif: "hypertrophie" },
  { percent: 70, reps: 12, objectif: "hypertrophie" },
  { percent: 65, reps: 15, objectif: "endurance" },
] as const;

/** Charge de travail pour un % du 1RM, arrondie à 0,5 kg (plaques réelles). */
export function loadForPercent(oneRM: number, percent: number): number {
  return Math.round((oneRM * percent) / 100 / 0.5) * 0.5;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
