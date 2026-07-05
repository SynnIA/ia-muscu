/**
 * Extrait le texte assistant d'une réponse UIMessage stream brute (best-effort).
 * Utilisé par les envois "fire-and-forget" hors useChat (saisie journal, avis coach photos).
 */
export function extractStreamText(raw: string): string {
  return [...raw.matchAll(/"type":"text-delta"[^}]*?"delta":"((?:[^"\\]|\\.)*)"/g)]
    .map((m) => JSON.parse(`"${m[1]}"`))
    .join("");
}

/** Vrai si le flux contient un chunk d'erreur (ne pas afficher de faux « Enregistré ✓ »). */
export function streamHasError(raw: string): boolean {
  return raw.includes('"type":"error"');
}
