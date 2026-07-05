import { createClient } from "@/lib/db/server";
import { parisDayRange } from "@/lib/dates";

/** Jours du mois ayant au moins une donnée — alimente le calendrier (client, instantané). */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Non authentifié", { status: 401 });
  const allowed = process.env.ALLOWED_EMAIL;
  if (allowed && user.email !== allowed) {
    return new Response("Accès refusé", { status: 403 });
  }

  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: "month invalide (YYYY-MM)" }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const monthFirst = `${month}-01`;
  const nextMonthFirst =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
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

  return Response.json({ days: [...s] });
}
