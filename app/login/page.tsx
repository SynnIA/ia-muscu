"use client";

import { Suspense, useState } from "react";
import { Dumbbell, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const info = searchParams.get("info");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setBusy(false);
      setErrorMsg(
        error.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : error.message
      );
    } else {
      router.push("/journal");
      router.refresh();
    }
  }

  return (
    <main className="forge-bg flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <div className="animate-rise flex flex-col items-center gap-4">
        <div className="glow-lime flex size-16 items-center justify-center rounded-2xl bg-lime-400 text-zinc-950">
          <Dumbbell className="size-8" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 className="display text-5xl font-extrabold uppercase tracking-wide text-zinc-50">
            La&nbsp;Forge
          </h1>
          <p className="display mt-1 text-sm font-semibold uppercase tracking-[0.25em] text-lime-400/90">
            Coach muscu &amp; nutrition
          </p>
        </div>
      </div>

      {info === "compte-cree" && (
        <p className="rounded-xl bg-lime-400/10 px-4 py-2 text-sm text-lime-300 ring-1 ring-lime-400/30">
          Compte créé ✅ — connecte-toi.
        </p>
      )}
      {info === "deja-cree" && (
        <p className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-zinc-300 ring-1 ring-zinc-800">
          Le compte existe déjà — connecte-toi.
        </p>
      )}

      <form onSubmit={signIn} className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="ton@email.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="press glow-lime display flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 text-lg font-bold uppercase tracking-wide text-zinc-950 transition-colors hover:bg-lime-300 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Se connecter
        </button>
        {errorMsg && <p className="text-center text-sm text-red-400">{errorMsg}</p>}
      </form>

      <div className="flex flex-col items-center gap-2">
        <Link href="/forgot" className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline">
          Mot de passe oublié ?
        </Link>
        <Link href="/setup" className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline">
          Première fois ? Créer le compte
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
