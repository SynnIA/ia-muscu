import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/journal" : "/login");
}
