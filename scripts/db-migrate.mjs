/**
 * Applique les migrations SQL de supabase/migrations/ dans l'ordre.
 * Passe par le POOLER Supabase (IPv4) car la connexion directe est IPv6-only.
 *
 * Usage : node scripts/db-migrate.mjs [--probe]
 *   --probe : teste seulement la connexion (découverte de la région du pooler)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env.local") });

const PROJECT_REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!PASSWORD) {
  console.error("SUPABASE_DB_PASSWORD manquant dans .env.local");
  process.exit(1);
}

// Candidats pooler (session mode, port 5432) — la bonne région répond, les autres
// renvoient "Tenant or user not found".
const REGIONS = ["eu-west-3", "eu-west-1", "eu-north-1", "eu-central-1", "eu-west-2"];
const HOST_PREFIXES = ["aws-0", "aws-1"];

// CA Supabase épinglée (récupérée du serveur, cf. certs/supabase-ca.pem)
const CA = readFileSync(join(root, "certs", "supabase-ca.pem"), "utf8");

async function tryConnect(host) {
  const client = new pg.Client({
    host,
    port: 5432,
    database: "postgres",
    user: `postgres.${PROJECT_REF}`,
    password: PASSWORD,
    ssl: { ca: CA }, // vérification TLS avec la CA Supabase épinglée
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

async function findPooler() {
  for (const region of REGIONS) {
    for (const prefix of HOST_PREFIXES) {
      const host = `${prefix}-${region}.pooler.supabase.com`;
      try {
        const client = await tryConnect(host);
        console.log(`✅ Connecté via ${host}`);
        return client;
      } catch (e) {
        console.log(`   ✗ ${host}: ${e.message.slice(0, 60)}`);
      }
    }
  }
  throw new Error("Aucun pooler ne répond — vérifier région/mot de passe.");
}

const client = await findPooler();

if (process.argv.includes("--probe")) {
  const { rows } = await client.query("select version()");
  console.log(rows[0].version);
  await client.end();
  process.exit(0);
}

// Table de suivi des migrations
await client.query(`
  create table if not exists _migrations (
    name text primary key,
    applied_at timestamptz default now()
  )
`);

const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  const { rows } = await client.query("select 1 from _migrations where name = $1", [file]);
  if (rows.length) {
    console.log(`⏭  ${file} (déjà appliquée)`);
    continue;
  }
  const sql = readFileSync(join(dir, file), "utf8");
  console.log(`▶  ${file}…`);
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("insert into _migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log(`✅ ${file}`);
  } catch (e) {
    await client.query("rollback");
    console.error(`❌ ${file}: ${e.message}`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("Terminé.");
