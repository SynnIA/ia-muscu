/**
 * Base de connaissances condensée — sources : position stands ISSN (open access)
 * et repères ANSES/PNNS. Statique et gratuite : injectée dans le prompt (résumé)
 * + consultable en détail via le tool get_knowledge.
 *
 * ⚠️ Les repères ANSES visent la population générale ; les recommandations ISSN
 * visent la performance/musculation — toujours préciser le cadre en réponse.
 */

export const KNOWLEDGE_SUMMARY = `# Repères scientifiques (résumé)
- Protéines (ISSN 2017, Jäger et al.) : 1,4–2,0 g/kg/j pour la plupart des pratiquants ; 2,3–3,1 g/kg/j possible en sèche pour préserver le muscle ; 20–40 g (0,25 g/kg) par prise toutes les 3–4 h.
- Timing (ISSN 2017, Kerksick et al.) : glucides 4–7 g/kg/j en musculation (8–12 si volume très élevé) ; ~30–40 g de caséine avant le coucher utile.
- Composition corporelle (ISSN 2017, Aragon et al.) : la perte de gras = déficit calorique soutenu ; perte lente = meilleure préservation musculaire chez les sujets déjà secs ; prise de masse = surplus modéré soutenu.
- Créatine (ISSN 2017, Kreider et al.) : monohydrate 3–5 g/j, l'aide ergogénique la plus efficace et sûre pour la force et la masse maigre.
- ANSES (population générale) : protéines ≥ 0,83 g/kg/j ; glucides 40–55 % de l'énergie ; fibres 30 g/j ; ≤ 100 g de sucres totaux/j ; PNNS : légumineuses ≥ 2×/sem, ≥ 5 fruits/légumes/j, réduire charcuterie et boissons sucrées.`;

export const KNOWLEDGE_TOPICS: Record<string, string> = {
  proteines: `Protéines — ISSN 2017 (Jäger et al., JISSN 14:20) :
- Apport quotidien : 1,4 à 2,0 g/kg/j suffisant pour la plupart des pratiquants pour construire et maintenir la masse musculaire.
- En déficit calorique (sèche) : 2,3 à 3,1 g/kg de masse maigre/j pour maximiser la rétention musculaire.
- Par prise : 20–40 g (≈ 0,25–0,40 g/kg), avec 700–3000 mg de leucine, toutes les 3–4 h.
- La qualité compte : sources complètes (œufs, laitages, viandes, poissons, soja).
ANSES (population générale) : besoin ~0,83 g/kg/j, relevé à ~1 g/kg/j après 65 ans (sarcopénie).`,

  glucides_timing: `Nutrient timing — ISSN 2017 (Kerksick et al., JISSN 14:33) :
- Glycogène : régime riche en glucides (8–12 g/kg/j si entraînement très intense, 4–7 g/kg/j en musculation classique).
- Autour de la séance : protéines 20–40 g dans les heures qui suivent ; la « fenêtre anabolique » est large si l'apport quotidien est atteint.
- Avant sommeil : ~30–40 g de caséine favorise la synthèse protéique nocturne.`,

  seche_prise_masse: `Diètes & composition corporelle — ISSN 2017 (Aragon et al.) :
- La perte de graisse est pilotée par un DÉFICIT calorique soutenu ; plus le % de masse grasse de départ est élevé, plus le déficit peut être agressif.
- Sujets déjà secs : perte LENTE (~0,5 %/sem) pour préserver la masse maigre.
- Prise de muscle : surplus modéré (~250–500 kcal/j) + entraînement en résistance progressif ; un gros surplus = plus de gras, pas plus de muscle.`,

  creatine: `Créatine — ISSN 2017 (Kreider et al., JISSN 14:18) :
- La créatine monohydrate est l'aide ergogénique nutritionnelle LA PLUS efficace pour la performance en haute intensité et la masse maigre.
- Dose : 3–5 g/jour en continu (la phase de charge 4×5 g/j pendant 5–7 j est optionnelle).
- Profil de sécurité favorable chez le sujet sain, y compris à long terme. Bien s'hydrater.
Note : certains auteurs déclarent des liens avec l'industrie des suppléments.`,

  cafeine: `Caféine — ISSN 2021 (Guest et al.) :
- Améliore force, endurance et vigilance à 3–6 mg/kg, 30–60 min avant l'effort.
- Tolérance et sensibilité très individuelles ; attention au sommeil (demi-vie ~5 h).`,

  reperes_anses: `Repères ANSES/PNNS (santé publique, population générale) :
- Protéines : ~0,83 g/kg/j (adulte sain), 10–20 % de l'énergie.
- Glucides : 40–55 % de l'énergie ; fibres : 30 g/j ; sucres totaux ≤ 100 g/j.
- PNNS 2017 : légumineuses ≥ 2×/semaine, céréales complètes, ≥ 5 fruits/légumes/j, huiles végétales (colza/noix/olive) ; réduire charcuterie (≤ 150 g/sem), viande hors volaille (≤ 500 g/sem), boissons sucrées.
⚠️ Ces repères visent la santé générale, PAS l'optimisation musculation — croiser avec les recommandations ISSN selon l'objectif.`,

  formules: `Formules utilisées par l'app (calculées par le code, jamais par l'IA) :
- BMR Mifflin-St Jeor : H = 10×poids + 6,25×taille − 5×âge + 5 ; F = idem − 161.
- TDEE = BMR × facteur d'activité (1,2 à 1,9).
- 1RM : moyenne d'Epley [poids×(1+reps/30)] et Brzycki [poids/(1,0278−0,0278×reps)], fiable de 1 à 10 reps.
- Charges : %1RM → 80 % ≈ 8 reps (hypertrophie), 90 % ≈ 3 reps (force).`,
};
