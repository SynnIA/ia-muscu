"use client";

import { ChevronsLeftRight, Loader2, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { resizeToDataUrl } from "@/lib/images";
import { extractStreamText, streamHasError } from "@/lib/ui-stream";

export type PhotoItem = {
  id: string;
  taken_at: string; // YYYY-MM-DD
  pose: "face" | "profil" | "dos";
  url: string; // URL signée
};

function fmtDate(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/**
 * Comparateur avant/après plein écran : deux photos superposées,
 * curseur draggable au milieu (clip-path). 100 % code, zéro IA —
 * sauf le bouton « Avis du coach » (vision, à la demande).
 */
export default function CompareSlider({
  before,
  after,
  onClose,
}: {
  before: PhotoItem;
  after: PhotoItem;
  onClose: () => void;
}) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const [coach, setCoach] = useState<string | null>(null);
  const [busyCoach, setBusyCoach] = useState(false);

  function updateFromPointer(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }

  async function askCoach() {
    if (busyCoach) return;
    setBusyCoach(true);
    setCoach(null);
    try {
      // Les URLs signées expirent : on envoie les images en data URL (1024px)
      const toDataUrl = async (u: string) =>
        resizeToDataUrl(await (await fetch(u)).blob(), 1024, 0.8);
      const [a, b] = await Promise.all([toDataUrl(before.url), toDataUrl(after.url)]);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "question",
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [
                {
                  type: "text",
                  text: `Compare mes deux photos de physique (pose ${before.pose}) : la première date du ${fmtDate(before.taken_at)}, la seconde du ${fmtDate(after.taken_at)}. Ton avis honnête sur l'évolution ?`,
                },
                { type: "file", mediaType: "image/jpeg", url: a },
                { type: "file", mediaType: "image/jpeg", url: b },
              ],
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      if (streamHasError(raw)) throw new Error("stream error");
      setCoach(extractStreamText(raw) || "Pas de réponse — réessaie.");
    } catch {
      setCoach("Erreur — réessaie (ou passe par l'onglet Coach).");
    } finally {
      setBusyCoach(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="display text-lg font-bold uppercase tracking-wide text-zinc-100">
          Avant / après <span className="text-zinc-500">· {before.pose}</span>
        </h2>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {/* Zone de comparaison */}
          <div
            ref={containerRef}
            className="relative w-full touch-none select-none overflow-hidden rounded-2xl bg-black ring-1 ring-zinc-800"
            style={{ aspectRatio: "3 / 4" }}
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              updateFromPointer(e.clientX);
            }}
            onPointerMove={(e) => dragging.current && updateFromPointer(e.clientX)}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={before.url}
              alt={`avant — ${fmtDate(before.taken_at)}`}
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={after.url}
              alt={`après — ${fmtDate(after.taken_at)}`}
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
            />
            {/* Curseur */}
            <div
              className="absolute inset-y-0 w-0.5 bg-white/80"
              style={{ left: `${pos}%` }}
            >
              <div className="glow-lime absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-lime-400 text-zinc-950 shadow-lg">
                <ChevronsLeftRight className="size-5" strokeWidth={2.5} />
              </div>
            </div>
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {fmtDate(before.taken_at)}
            </span>
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {fmtDate(after.taken_at)}
            </span>
          </div>

          <p className="text-center text-xs text-zinc-500">
            Glisse le curseur pour comparer
          </p>

          {/* Avis du coach — vision, uniquement à la demande */}
          <button
            onClick={askCoach}
            disabled={busyCoach}
            className="mx-auto flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200 transition hover:border-lime-400/50 disabled:opacity-50"
          >
            {busyCoach ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4 text-lime-400" />
            )}
            Avis du coach
          </button>

          {coach && (
            <p className="whitespace-pre-wrap rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-zinc-100 ring-1 ring-zinc-800">
              {coach}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
