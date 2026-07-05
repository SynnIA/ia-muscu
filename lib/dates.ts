/** Utilitaires de dates en fuseau Europe/Paris. */

/** Date du jour (Paris) au format YYYY-MM-DD. */
export function todayParis(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

/** Décale une date YYYY-MM-DD de n jours. */
export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`); // midi UTC = pas d'effet de bord DST
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Bornes UTC [start, end) de la journée Paris YYYY-MM-DD. */
export function parisDayRange(day: string): { start: string; end: string } {
  const midnightUtc = new Date(`${day}T00:00:00Z`);
  // Décalage Paris (+1 hiver / +2 été) lu de façon robuste via formatToParts
  // (Number("01 h") du format fr-FR renvoyait NaN → Invalid time value).
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "shortOffset",
  })
    .formatToParts(midnightUtc)
    .find((p) => p.type === "timeZoneName")?.value; // ex. "GMT+2"
  const offsetHours = Number(tzName?.replace("GMT", "")) || 0;
  const start = new Date(midnightUtc.getTime() - offsetHours * 3_600_000);
  const end = new Date(start.getTime() + 24 * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** "2026-07-02" → "mercredi 2 juillet" */
export function formatDayLong(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });
}
