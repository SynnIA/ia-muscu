/**
 * Seed de la table exercises depuis Free Exercise DB (domaine public).
 * Source : https://github.com/yuhonas/free-exercise-db
 * Usage : node scripts/seed-exercises.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env.local") });

const SOURCE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

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

console.log("Téléchargement de Free Exercise DB…");
const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const exercises = await res.json();
console.log(`${exercises.length} exercices récupérés.`);

const { rows } = await client.query("select count(*)::int as n from exercises");
if (rows[0].n > 0) {
  console.log(`Table déjà seedée (${rows[0].n} lignes) — abandon (relancer après TRUNCATE si besoin).`);
  await client.end();
  process.exit(0);
}

await client.query("begin");
try {
  for (const ex of exercises) {
    await client.query(
      `insert into exercises (ext_id, name, primary_muscles, secondary_muscles, equipment, level, mechanic, category, instructions)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (ext_id) do nothing`,
      [
        ex.id ?? ex.name,
        ex.name,
        ex.primaryMuscles ?? [],
        ex.secondaryMuscles ?? [],
        ex.equipment ?? null,
        ex.level ?? null,
        ex.mechanic ?? null,
        ex.category ?? null,
        ex.instructions ?? [],
      ]
    );
  }
  await client.query("commit");
  const { rows: after } = await client.query("select count(*)::int as n from exercises");
  console.log(`✅ ${after[0].n} exercices importés.`);
} catch (e) {
  await client.query("rollback");
  console.error("❌", e.message);
  process.exit(1);
} finally {
  await client.end();
}
