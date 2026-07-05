"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/client";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      aria-label="Se déconnecter"
      className="flex size-11 items-center justify-center rounded-xl text-zinc-500 transition active:bg-zinc-900 hover:text-zinc-300"
    >
      <LogOut className="size-5" />
    </button>
  );
}
