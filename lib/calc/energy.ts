/**
 * Formules énergétiques — déterministes, JAMAIS déléguées au LLM.
 * BMR : Mifflin-St Jeor (la plus validée — Frankenfield 2005).
 */

export type Sex = "M" | "F";
export type Goal = "perte" | "maintien" | "prise";

/** Facteurs d'activité (Mifflin-St Jeor). */
export const ACTIVITY_FACTORS = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  tres_actif: 1.725,
  extreme: 1.9,
} as const;

/** Métabolisme de base (kcal/jour). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === "M" ? base + 5 : base - 161);
}

/** Dépense énergétique totale (kcal/jour). */
export function tdee(bmrKcal: number, activityFactor: number): number {
  return Math.round(bmrKcal * activityFactor);
}

/** Cible calorique selon l'objectif (déficit/surplus ~400 kcal ≈ 0,4 kg/sem). */
export function calorieTarget(tdeeKcal: number, goal: Goal): number {
  if (goal === "perte") return tdeeKcal - 400;
  if (goal === "prise") return tdeeKcal + 350;
  return tdeeKcal;
}

/**
 * Répartition des macros (cadre ISSN musculation + bornes ANSES) :
 * protéines 1,8 g/kg (fourchette ISSN 1,6–2,2), lipides ≥ 0,8 g/kg,
 * le reste en glucides (borne ANSES 40–55 % AET vérifiée en pratique).
 */
export function macroTargets(weightKg: number, kcalTarget: number) {
  const protein_g = Math.round(weightKg * 1.8);
  const fat_g = Math.round(weightKg * 0.9);
  const kcalRemaining = kcalTarget - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(0, Math.round(kcalRemaining / 4));
  return { protein_g, carbs_g, fat_g };
}

/** Âge en années à partir d'une date de naissance ISO. */
export function ageFromBirthDate(birthDateISO: string): number {
  const birth = new Date(birthDateISO);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}
