/**
 * Ajoute les chemins d'images (Free Exercise DB) aux exercices existants.
 * Les images restent hébergées sur raw.githubusercontent.com (domaine public).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env.local"), quiet: true });

const PROJECT_REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const CA = readFileSync(join(root, "certs", "supabase-ca.pem"), "utf8");

const client = new pg.Client({
  host: "aws-0-eu-west-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: `postgres.${PROJECT_REF}`,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { ca: CA },
});
await client.connect();

const res = await fetch(
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
);
const exercises = await res.json();

let updated = 0;
for (const ex of exercises) {
  if (!ex.images?.length) continue;
  const r = await client.query(
    "update exercises set images = $1 where ext_id = $2 and (images = '{}' or images is null)",
    [ex.images, ex.id ?? ex.name]
  );
  updated += r.rowCount;
}
console.log(`✅ Images ajoutées sur ${updated} exercices.`);
await client.end();
