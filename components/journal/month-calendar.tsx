import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Calendrier du mois (100 % serveur, zéro JS client) : un point sous les jours
 * qui ont des données, tap → page du jour. Navigation ‹ › entre mois.
 */
export default function MonthCalendar({
  month, // "YYYY-MM"
  filledDays,
  currentDay,
  today,
}: {
  month: string;
  filledDays: string[];
  currentDay: string;
  today: string;
}) {
  const filled = new Set(filledDays);
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
    <div className="mx-auto w-full max-w-2xl px-4 pt-3">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="mb-1 flex items-center justify-between">
          <Link
            href={`/journal?d=${prevMonth}-01&cal=1`}
            aria-label="Mois précédent"
            className="flex size-9 items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-800"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <span className="text-sm font-medium capitalize text-zinc-100">{title}</span>
          {hasNext ? (
            <Link
              href={`/journal?d=${nextMonth}-01&cal=1`}
              aria-label="Mois suivant"
              className="flex size-9 items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-800"
            >
              <ChevronRight className="size-5" />
            </Link>
          ) : (
            <span className="size-9" />
          )}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w, i) => (
            <span key={`w${i}`} className="py-1 text-[10px] font-medium text-zinc-600">
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <span key={`e${i}`} />;
            const num = Number(d.slice(8));
            if (d > today) {
              return (
                <span key={d} className="flex flex-col items-center rounded-lg py-1.5 text-xs text-zinc-700">
                  {num}
                </span>
              );
            }
            const isCurrent = d === currentDay;
            return (
              <Link
                key={d}
                href={`/journal?d=${d}`}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs transition ${
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
  );
}
