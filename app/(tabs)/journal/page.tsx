import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Scale,
  UtensilsCrossed,
} from "lucide-react";
import { createClient } from "@/lib/db/server";
import { signedPhotoUrls } from "@/lib/photos/storage";
import { formatDayLong, parisDayRange, shiftDay, todayParis } from "@/lib/dates";
import QuickAdd from "@/components/journal/quick-add";
import LogoutButton from "@/components/journal/logout-button";
import MonthCalendar from "@/components/journal/month-calendar";

type SetRow = {
  exercise_name: string;
  reps: number | null;
  weight_kg: number | null;
  est_1rm: number | null;
};

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; cal?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayParis();
  const { d, cal } = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? d! : today;
  const calOpen = cal === "1";
  const { start, end } = parisDayRange(day);

  // Toutes les données du jour (RLS = uniquement les siennes)
  const [metricsQ, mealsQ, workoutsQ, activitiesQ] = await Promise.all([
    supabase
      .from("body_metrics")
      .select("weight_kg, body_fat_pct, notes")
      .eq("measured_at", day)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("meals")
      .select("id, eaten_at, description, kcal, protein_g, carbs_g, fat_g, source, photo_url")
      .gte("eaten_at", start)
      .lt("eaten_at", end)
      .order("eaten_at", { ascending: true }),
    supabase
      .from("workouts")
      .select("id, occurred_at, name, notes, workout_sets(exercise_name, reps, weight_kg, est_1rm)")
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("activities")
      .select("id, occurred_at, type, duration_min, distance_km, calories, source")
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .order("occurred_at", { ascending: true }),
  ]);

  const weight = metricsQ.data?.[0] ?? null;
  const meals = mealsQ.data ?? [];
  const workouts = workoutsQ.data ?? [];
  const activities = activitiesQ.data ?? [];

  // Miniatures des photos de repas (photo_url = path du bucket privé → URL signée)
  const mealPhotoUrls = await signedPhotoUrls(
    meals.map((m) => m.photo_url).filter((p): p is string => !!p)
  );

  // Calendrier du mois : jours ayant au moins une donnée (calculé seulement si ouvert)
  let filledDays: string[] = [];
  if (calOpen) {
    const [yy, mm] = day.split("-").map(Number);
    const monthFirst = `${yy}-${String(mm).padStart(2, "0")}-01`;
    const nextMonthFirst =
      mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
    const mStart = parisDayRange(monthFirst).start;
    const mEnd = parisDayRange(nextMonthFirst).start;
    const dayParis = (iso: string) =>
      new Date(iso).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });

    const [bm, ml, wk, ac] = await Promise.all([
      supabase
        .from("body_metrics")
        .select("measured_at")
        .gte("measured_at", monthFirst)
        .lt("measured_at", nextMonthFirst),
      supabase.from("meals").select("eaten_at").gte("eaten_at", mStart).lt("eaten_at", mEnd),
      supabase
        .from("workouts")
        .select("occurred_at")
        .gte("occurred_at", mStart)
        .lt("occurred_at", mEnd),
      supabase
        .from("activities")
        .select("occurred_at")
        .gte("occurred_at", mStart)
        .lt("occurred_at", mEnd),
    ]);
    const s = new Set<string>();
    for (const r of bm.data ?? []) s.add(r.measured_at as string);
    for (const r of ml.data ?? []) s.add(dayParis(r.eaten_at as string));
    for (const r of wk.data ?? []) s.add(dayParis(r.occurred_at as string));
    for (const r of ac.data ?? []) s.add(dayParis(r.occurred_at as string));
    filledDays = [...s];
  }

  // Totaux du jour — calculés par le CODE
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const totKcal = r1(meals.reduce((a, m) => a + Number(m.kcal ?? 0), 0));
  const totProt = r1(meals.reduce((a, m) => a + Number(m.protein_g ?? 0), 0));
  const totVolume = r1(
    workouts.reduce(
      (a, w) =>
        a +
        (w.workout_sets ?? []).reduce(
          (b: number, s: SetRow) => b + (Number(s.reps) || 0) * (Number(s.weight_kg) || 0),
          0
        ),
      0
    )
  );
  const totActivity = r1(activities.reduce((a, x) => a + Number(x.duration_min ?? 0), 0));

  const isEmpty = !weight && !meals.length && !workouts.length && !activities.length;
  const hourOf = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });

  /** Agrège les séries par exercice pour un affichage compact. */
  function summarizeSets(sets: SetRow[]) {
    const byExo = new Map<string, SetRow[]>();
    for (const s of sets) {
      byExo.set(s.exercise_name, [...(byExo.get(s.exercise_name) ?? []), s]);
    }
    return [...byExo.entries()].map(([name, ss]) => {
      const reps = [...new Set(ss.map((s) => s.reps))].filter(Boolean);
      const maxW = Math.max(...ss.map((s) => Number(s.weight_kg) || 0));
      const best1rm = Math.max(...ss.map((s) => Number(s.est_1rm) || 0));
      return {
        name,
        detail: `${ss.length} série${ss.length > 1 ? "s" : ""} · ${reps.join("/")} reps · ${maxW} kg${
          best1rm ? ` · 1RM est. ${best1rm} kg` : ""
        }`,
      };
    });
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      {/* Navigation par jour — collante en haut */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-2 py-1.5">
          <Link
            href={`/journal?d=${shiftDay(day, -1)}`}
            aria-label="Jour précédent"
            className="flex size-11 items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-900"
          >
            <ChevronLeft className="size-6" />
          </Link>
          <div className="text-center">
            <Link
              href={calOpen ? `/journal?d=${day}` : `/journal?d=${day}&cal=1`}
              className="block"
            >
              <h1 className="text-sm font-semibold capitalize text-zinc-100">
                {formatDayLong(day)}{" "}
                <span className="text-xs text-zinc-500">{calOpen ? "▴" : "▾"}</span>
              </h1>
            </Link>
            {day !== today && (
              <Link href="/journal" className="text-xs text-lime-400">
                Revenir à aujourd&apos;hui
              </Link>
            )}
          </div>
          <div className="flex items-center">
            <Link
              href={`/journal?d=${shiftDay(day, 1)}`}
              aria-label="Jour suivant"
              className={`flex size-11 items-center justify-center rounded-xl active:bg-zinc-900 ${
                day >= today ? "pointer-events-none opacity-30" : "text-zinc-400"
              }`}
            >
              <ChevronRight className="size-6" />
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      {calOpen && (
        <MonthCalendar
          month={day.slice(0, 7)}
          filledDays={filledDays}
          currentDay={day}
          today={today}
        />
      )}

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4 pb-8">

        {/* Totaux du jour */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "kcal", value: totKcal, Icon: Flame },
            { label: "prot (g)", value: totProt, Icon: UtensilsCrossed },
            { label: "volume (kg)", value: totVolume, Icon: Dumbbell },
            { label: "cardio (min)", value: totActivity, Icon: Activity },
          ].map(({ label, value, Icon }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-2 py-3"
            >
              <Icon className="size-4 text-lime-400" />
              <span className="text-base font-semibold text-zinc-100">{value || "—"}</span>
              <span className="text-[10px] text-zinc-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Saisie directe */}
        <QuickAdd day={day} />

        {isEmpty && (
          <p className="py-8 text-center text-sm text-zinc-500">
            Rien ce jour-là. Raconte ta journée ci-dessus 👆 ou passe par l&apos;onglet Coach.
          </p>
        )}

        {/* Poids */}
        {weight && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Scale className="size-4 text-lime-400" /> Poids
            </h2>
            <p className="text-sm text-zinc-100">
              <span className="text-lg font-semibold">{weight.weight_kg} kg</span>
              {weight.body_fat_pct && (
                <span className="ml-2 text-zinc-400">· {weight.body_fat_pct} % MG</span>
              )}
            </p>
            {weight.notes && <p className="mt-1 text-xs text-zinc-500">{weight.notes}</p>}
          </section>
        )}

        {/* Séances */}
        {workouts.map((w) => (
          <section key={w.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Dumbbell className="size-4 text-lime-400" />
              {w.name || "Séance"}
              <span className="ml-auto text-xs font-normal text-zinc-500">
                {hourOf(w.occurred_at)}
              </span>
            </h2>
            <ul className="flex flex-col gap-1.5">
              {summarizeSets((w.workout_sets ?? []) as SetRow[]).map((e) => (
                <li key={e.name} className="text-sm">
                  <span className="text-zinc-100">{e.name}</span>
                  <span className="block text-xs text-zinc-500">{e.detail}</span>
                </li>
              ))}
            </ul>
            {w.notes && <p className="mt-2 text-xs text-zinc-500">{w.notes}</p>}
          </section>
        ))}

        {/* Repas */}
        {meals.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <UtensilsCrossed className="size-4 text-lime-400" /> Repas
            </h2>
            <ul className="flex flex-col gap-2">
              {meals.map((m) => {
                const photo = m.photo_url ? mealPhotoUrls.get(m.photo_url) : null;
                return (
                  <li key={m.id} className="flex items-start gap-2.5 text-sm">
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt={m.description ?? "photo du repas"}
                        loading="lazy"
                        className="mt-0.5 size-12 shrink-0 rounded-lg object-cover ring-1 ring-zinc-800"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-zinc-100">{m.description}</span>
                        <span className="shrink-0 text-xs text-zinc-500">{hourOf(m.eaten_at)}</span>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {m.kcal ?? "?"} kcal · P {m.protein_g ?? "?"} · G {m.carbs_g ?? "?"} · L{" "}
                        {m.fat_g ?? "?"}
                        {m.source === "estimation" && " · ~estimation"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Activités */}
        {activities.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Activity className="size-4 text-lime-400" /> Cardio / activités
            </h2>
            <ul className="flex flex-col gap-1.5">
              {activities.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between text-sm">
                  <span className="capitalize text-zinc-100">{a.type}</span>
                  <span className="text-xs text-zinc-500">
                    {a.duration_min} min
                    {a.distance_km ? ` · ${a.distance_km} km` : ""}
                    {a.calories ? ` · ${a.calories} kcal` : ""}
                    {a.source === "strava" ? " · Strava" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
