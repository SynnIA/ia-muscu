"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/client";

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (password.length < 8) {
      setErrorMsg("8 caractères minimum.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setErrorMsg(
        error.message.includes("session")
          ? "Session expirée — redemande un lien depuis « mot de passe oublié »."
          : error.message
      );
      return;
    }
    router.push("/journal");
    router.refresh();
  }

  return (
    <main className="forge-bg flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <div className="animate-rise flex flex-col items-center gap-3">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-lime-400/10 ring-1 ring-lime-400/30">
          <ShieldCheck className="size-8 text-lime-400" />
        </div>
        <h1 className="display text-3xl font-bold uppercase tracking-wide text-zinc-50">
          Nouveau mot de passe
        </h1>
        <p className="text-sm text-zinc-400">Choisis-le solide, comme tes squats.</p>
      </div>

      <form onSubmit={updatePassword} className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="Nouveau mot de passe (8+ caractères)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none"
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="Confirme le mot de passe"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Enregistrer
        </button>
        {errorMsg && <p className="text-center text-sm text-red-400">{errorMsg}</p>}
      </form>

      <Link
        href="/forgot"
        className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
      >
        Lien expiré ? Redemander un email
      </Link>
    </main>
  );
}
