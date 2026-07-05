/**
 * Crée le bucket Storage privé `photos` (photos physique + repas).
 * Idempotent — pas de policies storage : les accès passent par le client
 * admin server-only (upload + URLs signées), jamais par le navigateur.
 *
 * Usage : node scripts/setup-storage.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY manquants dans .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("listBuckets:", listErr.message);
  process.exit(1);
}

if (buckets.some((b) => b.name === "photos")) {
  console.log("⏭  bucket `photos` déjà présent");
} else {
  const { error } = await supabase.storage.createBucket("photos", {
    public: false,
    fileSizeLimit: "10MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error) {
    console.error("createBucket:", error.message);
    process.exit(1);
  }
  console.log("✅ bucket privé `photos` créé");
}
