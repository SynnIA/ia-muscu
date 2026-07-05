"use client";

import { Loader2, SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractStreamText, streamHasError } from "@/lib/ui-stream";

/**
 * Saisie directe dans la journée : le texte part vers l'IA (même endpoint que
 * le chat → mêmes tools, même mémoire), puis la page se rafraîchit.
 */
export default function QuickAdd({ day }: { day: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setReply(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "info", // log éclair : prompt minimal, réponse 1 phrase
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [
                {
                  type: "text",
                  text: `[Saisie journal du ${day}] ${t}`,
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Extrait le texte de la réponse depuis le flux UIMessage (best-effort)
      const raw = await res.text();
      if (streamHasError(raw)) throw new Error("stream error");
      const deltas = extractStreamText(raw);
      setReply(deltas || "Enregistré ✓");
      setText("");
      router.refresh();
    } catch {
      setReply("Erreur — réessaie (ou passe par l'onglet Coach).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex items-end gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écris ta journée… (ex. 4×8 squat à 80 kg)"
          enterKeyHint="send"
          className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Enregistrer"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-zinc-950 transition hover:bg-lime-300 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <SendHorizontal className="size-5" />
          )}
        </button>
      </form>
      {reply && (
        <p className="mt-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs text-zinc-300 ring-1 ring-zinc-800">
          {reply}
        </p>
      )}
    </div>
  );
}
