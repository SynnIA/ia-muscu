import { redirect } from "next/navigation";
import { Dumbbell, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";

/** Le compte autorisé existe-t-il déjà ? */
async function allowedUserExists(): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
  return (data?.users ?? []).some((u) => u.email?.toLowerCase() === allowed);
}

function validate(formData: FormData): string | { password: string } {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return "trop-court";
  if (password !== confirm) return "differents";
  return { password };
}

/** Cas 1 : aucun compte → création pré-confirmée (aucun email envoyé). */
async function createAccount(formData: FormData) {
  "use server";
  if (await allowedUserExists()) redirect("/login?info=deja-cree");

  const v = validate(formData);
  if (typeof v === "string") redirect(`/setup?error=${v}`);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: process.env.ALLOWED_EMAIL!,
    password: v.password,
    email_confirm: true,
  });
  if (error) redirect(`/setup?error=${encodeURIComponent(error.message)}`);

  redirect("/login?info=compte-cree");
}

/** Cas 2 : déjà connecté → définit/écrase le mot de passe via SA session. */
async function setPassword(formData: FormData) {
  "use server";
  const v = validate(formData);
  if (typeof v === "string") redirect(`/setup?error=${v}`);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: v.password });
  if (error) redirect(`/setup?error=${encodeURIComponent(error.message)}`);

  redirect("/journal");
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const exists = await allowedUserExists();
  // Ni connecté, ni de compte à créer → rien à faire ici
  if (!user && exists) redirect("/login?info=deja-cree");

  const { error } = await searchParams;
  const errorMsg =
    error === "trop-court"
      ? "8 caractères minimum."
      : error === "differents"
        ? "Les deux mots de passe ne correspondent pas."
        : error;

  const loggedIn = Boolean(user);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-zinc-950 px-6">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-lime-400/10 ring-1 ring-lime-400/30">
          <Dumbbell className="size-8 text-lime-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-50">La Forge</h1>
        <p className="flex items-center gap-1.5 text-sm text-zinc-400">
          <ShieldCheck className="size-4 text-lime-400" />
          {loggedIn ? "Définis ton mot de passe" : "Création de ton compte"}
        </p>
      </div>

      <form
        action={loggedIn ? setPassword : createAccount}
        className="flex w-full max-w-sm flex-col gap-3"
      >
        <p className="text-center text-sm text-zinc-500">
          Compte :{" "}
          <strong className="text-zinc-300">
            {user?.email ?? process.env.ALLOWED_EMAIL}
          </strong>
        </p>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Choisis un mot de passe (8+ caractères)"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none"
        />
        <input
          type="password"
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Confirme le mot de passe"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-lime-400 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-lime-300"
        >
          {loggedIn ? "Enregistrer mon mot de passe 🔒" : "Créer mon compte 🔥"}
        </button>
        {errorMsg && <p className="text-center text-sm text-red-400">{errorMsg}</p>}
      </form>
    </main>
  );
}
