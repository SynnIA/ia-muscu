"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDayLong } from "@/lib/dates";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Titre-date du journal + calendrier en dropdown 100 % client :
 * ouverture INSTANTANÉE (état local), jours remplis chargés en arrière-plan
 * via /api/journal/days avec cache par mois.
 */
export default function DateHeader({ day, today }: { day: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(day.slice(0, 7));
  const [cache, setCache] = useState<Record<string, string[]>>({});

  // Navigation vers un autre jour → recentre le calendrier sur son mois
  // (ajustement d'état pendant le rendu : pattern React officiel)
  const [prevDay, setPrevDay] = useState(day);
  if (prevDay !== day) {
    setPrevDay(day);
    setMonth(day.slice(0, 7));
  }

  // Charge les jours remplis du mois affiché (une seule fois par mois, en fond)
  useEffect(() => {
    if (!open || cache[month] !== undefined) return;
    let cancelled = false;
    fetch(`/api/journal/days?month=${month}`)
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((j) => {
        if (!cancelled) setCache((c) => ({ ...c, [month]: j.days ?? [] }));
      })
      .catch(() => {
        if (!cancelled) setCache((c) => ({ ...c, [month]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, month, cache]);

  const filled = new Set(cache[month] ?? []);
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7; // lundi = 0
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const hasNext = nextMonth <= today.slice(0, 7);
  const title = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`
    ),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press block w-full cursor-pointer"
      >
        <h1 className="display text-lg font-bold uppercase tracking-wide text-zinc-100">
          {formatDayLong(day)}{" "}
          <span className="text-xs text-zinc-500">{open ? "▴" : "▾"}</span>
        </h1>
      </button>
      {day !== today && (
        <Link href="/journal" className="text-xs text-lime-400">
          Revenir à aujourd&apos;hui
        </Link>
      )}

      {open && (
        <>
          {/* Tap extérieur = fermer */}
          <button
            type="button"
            aria-label="Fermer le calendrier"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute inset-x-0 top-full z-20 border-b border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur">
            <div className="mx-auto max-w-2xl px-4 py-3">
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMonth(prevMonth)}
                  aria-label="Mois précédent"
                  className="press flex size-9 cursor-pointer items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-800"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <span className="display text-sm font-bold uppercase tracking-wide text-zinc-100">
                  {title}
                </span>
                {hasNext ? (
                  <button
                    type="button"
                    onClick={() => setMonth(nextMonth)}
                    aria-label="Mois suivant"
                    className="press flex size-9 cursor-pointer items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-800"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                ) : (
                  <span className="size-9" />
                )}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((w, i) => (
                  <span
                    key={`w${i}`}
                    className="display py-1 text-[10px] font-semibold uppercase text-zinc-600"
                  >
                    {w}
                  </span>
                ))}
                {cells.map((d, i) => {
                  if (d === null) return <span key={`e${i}`} />;
                  const num = Number(d.slice(8));
                  if (d > today) {
                    return (
                      <span
                        key={d}
                        className="flex flex-col items-center rounded-lg py-1.5 text-xs text-zinc-700"
                      >
                        {num}
                      </span>
                    );
                  }
                  const isCurrent = d === day;
                  return (
                    <Link
                      key={d}
                      href={`/journal?d=${d}`}
                      onClick={() => setOpen(false)}
                      className={`press flex cursor-pointer flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs ${
                        isCurrent
                          ? "bg-lime-400 font-semibold text-zinc-950"
                          : "text-zinc-300 active:bg-zinc-800"
                      }`}
                    >
                      {num}
                      <span
                        className={`size-1 rounded-full ${
                          filled.has(d)
                            ? isCurrent
                              ? "bg-zinc-950"
                              : "bg-lime-400"
                            : "bg-transparent"
                        }`}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
