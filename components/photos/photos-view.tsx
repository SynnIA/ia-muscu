"use client";

import { Camera, GitCompareArrows, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { todayParis } from "@/lib/dates";
import { resizeToDataUrl } from "@/lib/images";
import CompareSlider, { type PhotoItem } from "@/components/photos/compare-slider";

const POSES = ["face", "profil", "dos"] as const;
type Pose = (typeof POSES)[number];

function fmtDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/**
 * Galerie des photos de physique : upload tagué par pose, groupement par date,
 * sélection de 2 photos → comparateur avant/après.
 */
export default function PhotosView({ photos }: { photos: PhotoItem[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pose, setPose] = useState<Pose>("face");
  const [takenAt, setTakenAt] = useState(todayParis());
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sélection (2 max, on garde les 2 dernières tapées)
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const byDay = useMemo(() => {
    const m = new Map<string, PhotoItem[]>();
    for (const p of photos) m.set(p.taken_at, [...(m.get(p.taken_at) ?? []), p]);
    return [...m.entries()]; // déjà trié desc par la page serveur
  }, [photos]);

  const selectedPhotos = selected
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is PhotoItem => !!p);

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 2
          ? [...prev, id]
          : [prev[1], id]
    );
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      // 1600px : assez fin pour juger un physique, léger pour le stockage
      const dataUrl = await resizeToDataUrl(file, 1600, 0.85);
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photo: dataUrl, pose, taken_at: takenAt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUploadOpen(false);
      router.refresh();
    } catch {
      setUploadError("Échec de l'upload — réessaie.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteSelected() {
    if (deleting || selectedPhotos.length !== 1) return;
    if (!window.confirm("Supprimer cette photo ? (définitif)")) return;
    setDeleting(true);
    try {
      await fetch(`/api/photos?id=${selectedPhotos[0].id}`, { method: "DELETE" });
      setSelected([]);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  // Comparateur : "avant" = la plus ancienne des deux
  const [before, after] =
    selectedPhotos.length === 2
      ? [...selectedPhotos].sort((a, b) => a.taken_at.localeCompare(b.taken_at))
      : [null, null];

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">Photos</h1>
            <p className="text-[11px] text-zinc-500">
              Sélectionne 2 photos pour un avant/après
            </p>
          </div>
          <button
            onClick={() => setUploadOpen((v) => !v)}
            aria-label="Ajouter une photo"
            className={`flex size-10 items-center justify-center rounded-xl border transition ${
              uploadOpen
                ? "border-lime-400/60 bg-lime-400/10 text-lime-400"
                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-lime-400"
            }`}
          >
            {uploadOpen ? <X className="size-5" /> : <Plus className="size-5" />}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4 pb-24">
        {/* Panneau d'upload */}
        {uploadOpen && (
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center gap-2">
              {POSES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPose(p)}
                  className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${
                    pose === p
                      ? "bg-lime-400 font-medium text-zinc-950"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {p}
                </button>
              ))}
              <input
                type="date"
                value={takenAt}
                max={todayParis()}
                onChange={(e) => setTakenAt(e.target.value)}
                className="ml-auto rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-lime-400/50 focus:outline-none"
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-lime-300 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              Choisir la photo ({pose})
            </button>
            {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
          </div>
        )}

        {photos.length === 0 && !uploadOpen && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Camera className="size-8 text-zinc-700" />
            <p className="text-sm text-zinc-400">Aucune photo pour l&apos;instant.</p>
            <p className="max-w-xs text-xs text-zinc-500">
              Ajoute des photos face / profil / dos régulièrement, et compare ton
              évolution avec le curseur avant/après. 📈
            </p>
          </div>
        )}

        {/* Galerie groupée par date */}
        {byDay.map(([day, items]) => (
          <section key={day}>
            <h2 className="mb-2 text-xs font-medium capitalize text-zinc-400">
              {fmtDay(day)}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {items.map((p) => {
                const idx = selected.indexOf(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleSelect(p.id)}
                    className={`relative overflow-hidden rounded-xl bg-zinc-900 ring-2 transition ${
                      idx >= 0 ? "ring-lime-400" : "ring-transparent"
                    }`}
                    style={{ aspectRatio: "3 / 4" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`${p.pose} — ${day}`}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] capitalize text-white">
                      {p.pose}
                    </span>
                    {idx >= 0 && (
                      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-lime-400 text-[11px] font-bold text-zinc-950">
                        {idx + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Barre d'action flottante */}
      {selected.length > 0 && (
        <div className="pointer-events-none sticky bottom-4 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-2 shadow-xl backdrop-blur">
            {selected.length === 2 && (
              <button
                onClick={() => setCompareOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-lime-300"
              >
                <GitCompareArrows className="size-4" /> Comparer
              </button>
            )}
            {selected.length === 1 && (
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-red-400 transition hover:border-red-400/40 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Supprimer
              </button>
            )}
            <button
              onClick={() => setSelected([])}
              className="rounded-xl px-3 py-2.5 text-sm text-zinc-400 transition hover:text-zinc-200"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {compareOpen && before && after && (
        <CompareSlider
          before={before}
          after={after}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}
