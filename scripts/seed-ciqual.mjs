/**
 * Seed de la table foods depuis CIQUAL (ANSES, open data).
 * Télécharge le XLSX officiel, nettoie les valeurs FR ("traces", "< 0,5", virgules)
 * et insère ~3400 aliments.
 * Usage : node scripts/seed-ciqual.mjs [url_xlsx]
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env.local") });

// URLs candidates (la 1re qui répond gagne) — table CIQUAL FR
const URLS = process.argv[2]
  ? [process.argv[2]]
  : [
      "https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202020_FR_2020%2007%2007.xlsx",
      "https://www.data.gouv.fr/fr/datasets/r/f1170dd7-85c9-49f7-ba53-e1a24e957c48",
    ];

const PROJECT_REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const CA = readFileSync(join(root, "certs", "supabase-ca.pem"), "utf8");

/** "12,5" → 12.5 ; "traces"/"-" → 0/null ; "< 0,5" → 0.5 */
function parseVal(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  let s = String(v).trim().toLowerCase();
  if (!s || s === "-" || s === "nd") return null;
  if (s === "traces") return 0;
  s = s.replace("<", "").replace(",", ".").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

let buffer = null;
for (const url of URLS) {
  try {
    console.log(`Téléchargement : ${url}`);
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
    console.log(`OK (${(buffer.length / 1e6).toFixed(1)} Mo)`);
    break;
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
  }
}
if (!buffer) {
  console.error("Aucune source CIQUAL accessible. Télécharge le XLSX sur ciqual.anses.fr et relance : node scripts/seed-ciqual.mjs <chemin_ou_url>");
  process.exit(1);
}

const wb = XLSX.read(buffer, { type: "buffer" });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
console.log(`${rows.length} lignes lues, colonnes : ${Object.keys(rows[0] ?? {}).slice(0, 6).join(" | ")}…`);

// Repérage des colonnes par mots-clés (robuste aux variations de libellés)
const cols = Object.keys(rows[0] ?? {});
const find = (...keywords) =>
  cols.find((c) => keywords.every((k) => c.toLowerCase().includes(k.toLowerCase())));

const COL = {
  code: find("alim_code") ?? find("code"),
  name: find("alim_nom_fr") ?? find("nom_fr") ?? find("nom"),
  kcal: find("energie", "kcal"),
  protein: find("protéines") ?? find("proteines"),
  carbs: find("glucides"),
  fat: find("lipides"),
  fiber: find("fibres alimentaires"),
  sugar: find("sucres ("),
  salt: find("sel"),
};
console.log("Mapping colonnes :", COL);
if (!COL.code || !COL.name || !COL.kcal) {
  console.error("Colonnes essentielles introuvables — vérifier le fichier.");
  process.exit(1);
}

const client = new pg.Client({
  host: "aws-0-eu-west-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: `postgres.${PROJECT_REF}`,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { ca: CA },
});
await client.connect();

const { rows: existing } = await client.query("select count(*)::int as n from foods");
if (existing[0].n > 0) {
  console.log(`Table déjà seedée (${existing[0].n} lignes) — abandon.`);
  await client.end();
  process.exit(0);
}

await client.query("begin");
try {
  let inserted = 0;
  for (const row of rows) {
    const name = row[COL.name];
    if (!name) continue;
    await client.query(
      `insert into foods (ciqual_code, name_fr, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, salt_100g)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (ciqual_code) do nothing`,
      [
        String(row[COL.code]),
        String(name).trim(),
        parseVal(row[COL.kcal]),
        COL.protein ? parseVal(row[COL.protein]) : null,
        COL.carbs ? parseVal(row[COL.carbs]) : null,
        COL.fat ? parseVal(row[COL.fat]) : null,
        COL.fiber ? parseVal(row[COL.fiber]) : null,
        COL.sugar ? parseVal(row[COL.sugar]) : null,
        COL.salt ? parseVal(row[COL.salt]) : null,
      ]
    );
    inserted++;
  }
  await client.query("commit");
  console.log(`✅ ${inserted} aliments importés.`);
} catch (e) {
  await client.query("rollback");
  console.error("❌", e.message);
  process.exit(1);
} finally {
  await client.end();
}
