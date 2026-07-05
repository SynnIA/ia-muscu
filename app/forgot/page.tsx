"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/db/client";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/confirm?next=/reset`,
    });
    // Toujours le même message : ne révèle pas si l'email existe
    setSent(true);
    setBusy(false);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-zinc-950 px-6">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-lime-400/10 ring-1 ring-lime-400/30">
          <KeyRound className="size-8 text-lime-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-50">Mot de passe oublié</h1>
        <p className="max-w-xs text-center text-sm text-zinc-400">
          Donne ton email : si un compte existe, tu recevras un lien pour en
          forger un nouveau. 🔧
        </p>
      </div>

      {sent ? (
        <p className="max-w-sm rounded-xl bg-lime-400/10 px-4 py-3 text-center text-sm text-lime-300 ring-1 ring-lime-400/30">
          Email envoyé ✅ — vérifie ta boîte (et les spams). Le lien expire
          vite.
        </p>
      ) : (
        <form onSubmit={requestReset} className="flex w-full max-w-sm flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="ton@email.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Envoyer le lien
          </button>
        </form>
      )}

      <Link
        href="/login"
        className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
      >
        ← Retour à la connexion
      </Link>
    </main>
  );
}
