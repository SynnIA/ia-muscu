import { redirect } from "next/navigation";
import { Dumbbell, Search } from "lucide-react";
import { createClient } from "@/lib/db/server";

const MUSCLES: Record<string, string> = {
  abdominals: "Abdos",
  abductors: "Abducteurs",
  adductors: "Adducteurs",
  biceps: "Biceps",
  calves: "Mollets",
  chest: "Pectoraux",
  forearms: "Avant-bras",
  glutes: "Fessiers",
  hamstrings: "Ischios",
  lats: "Dorsaux",
  "lower back": "Lombaires",
  "middle back": "Milieu du dos",
  neck: "Cou",
  quadriceps: "Quadriceps",
  shoulders: "Épaules",
  traps: "Trapèzes",
  triceps: "Triceps",
};

const EQUIPMENT: Record<string, string> = {
  barbell: "Barre",
  dumbbell: "Haltères",
  "body only": "Poids du corps",
  machine: "Machine",
  cable: "Poulie",
  kettlebells: "Kettlebell",
  bands: "Élastiques",
  "e-z curl bar": "Barre EZ",
  "medicine ball": "Medicine ball",
  "exercise ball": "Swiss ball",
  other: "Autre",
};

const LEVELS: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  expert: "Avancé",
};

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; muscle?: string; equipment?: string; n?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { q, muscle, equipment, n } = await searchParams;
  const limit = Math.min(Math.max(Number(n) || 40, 40), 400);

  let query = supabase
    .from("exercises")
    .select(
      "id, name, name_fr, primary_muscles, equipment, level, mechanic, instructions, instructions_fr, images"
    )
    .order("name_fr", { nullsFirst: false })
    .limit(limit);
  if (q?.trim()) query = query.or(`name_fr.ilike.%${q.trim()}%,name.ilike.%${q.trim()}%`);
  if (muscle && MUSCLES[muscle]) query = query.contains("primary_muscles", [muscle]);
  if (equipment && EQUIPMENT[equipment]) query = query.eq("equipment", equipment);

  const { data: exercises } = await query;

  return (
    <div className="forge-bg h-full overflow-y-auto overscroll-contain">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-4 pb-8">
        <h1 className="display flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-zinc-100">
          <Dumbbell className="size-5 text-lime-400" />
          Bibliothèque d&apos;exercices
        </h1>

        {/* Filtres (GET → partageable, zéro JS) */}
        <form className="flex flex-col gap-2" action="/exercises" method="get">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Chercher un exercice…"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              name="muscle"
              defaultValue={muscle ?? ""}
              className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-zinc-100"
            >
              <option value="">Tous muscles</option>
              {Object.entries(MUSCLES).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            <select
              name="equipment"
              defaultValue={equipment ?? ""}
              className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-zinc-100"
            >
              <option value="">Tout matériel</option>
              {Object.entries(EQUIPMENT).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="press display cursor-pointer rounded-xl bg-lime-400 px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-950 transition-colors hover:bg-lime-300"
            >
              OK
            </button>
          </div>
        </form>

        {/* Résultats */}
        {!exercises?.length ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            Aucun exercice trouvé — essaie un autre terme (« développé », « curl », « squat »…).
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {exercises.map((ex) => {
              const steps: string[] =
                (ex.instructions_fr?.length ? ex.instructions_fr : ex.instructions) ?? [];
              return (
                <li key={ex.id}>
                  <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 transition-colors duration-200 open:border-lime-400/30 hover:border-zinc-700">
                    <summary className="cursor-pointer list-none">
                      <span className="text-sm font-medium text-zinc-100">
                        {ex.name_fr ?? ex.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {ex.name_fr ? `${ex.name} · ` : ""}
                        {(ex.primary_muscles ?? [])
                          .map((m: string) => MUSCLES[m] ?? m)
                          .join(", ")}
                        {ex.equipment ? ` · ${EQUIPMENT[ex.equipment] ?? ex.equipment}` : ""}
                        {ex.level ? ` · ${LEVELS[ex.level] ?? ex.level}` : ""}
                      </span>
                    </summary>
                    {(ex.images ?? []).length > 0 && (
                      <div className="mt-2 flex gap-2 overflow-x-auto">
                        {(ex.images as string[]).slice(0, 2).map((img) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={img}
                            src={`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${img}`}
                            alt={ex.name_fr ?? ex.name}
                            loading="lazy"
                            className="h-36 rounded-xl bg-zinc-800 object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {steps.length > 0 && (
                      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-xs text-zinc-400">
                        {steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        {(exercises?.length ?? 0) >= limit && (
          <a
            href={`/exercises?${new URLSearchParams({
              ...(q ? { q } : {}),
              ...(muscle ? { muscle } : {}),
              ...(equipment ? { equipment } : {}),
              n: String(limit + 40),
            }).toString()}`}
            className="rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 text-center text-sm text-zinc-300 transition hover:border-lime-400/50"
          >
            Afficher plus ({limit} affichés)
          </a>
        )}
      </div>
    </div>
  );
}
