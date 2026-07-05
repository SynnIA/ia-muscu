import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client ADMIN (clé secrète) — STRICTEMENT server-only.
 * Utilisé uniquement pour créer le compte pré-confirmé (page /setup).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
