/**
 * Traduction one-shot des exercices (nom + instructions) EN → FR via Haiku.
 * Prévu au plan (PLAN.md §8) : pré-traitement par lots, UNE seule fois (~1 €).
 * Reprend là où il s'est arrêté (ne retraduit pas les lignes déjà faites).
 * Usage : node scripts/translate-exercises.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env.local"), quiet: true });

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

const { rows: todo } = await client.query(
  `select id, name, instructions from exercises
   where name_fr is null or instructions_fr = '{}'
   order by name`
);
console.log(`${todo.length} exercices à traduire.`);

const BATCH = 12;
const schema = z.object({
  traductions: z.array(
    z.object({
      id: z.string(),
      name_fr: z.string().describe("Nom français usuel en salle de sport"),
      instructions_fr: z.array(z.string()).describe("Instructions traduites, une par étape"),
    })
  ),
});

let done = 0;
let usage = { input: 0, output: 0 };

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const payload = batch.map((e) => ({
    id: e.id,
    name: e.name,
    instructions: (e.instructions ?? []).slice(0, 12),
  }));

  try {
    const { object, usage: u } = await generateObject({
      model: anthropic("claude-haiku-4-5"),
      schema,
      prompt: `Traduis ces exercices de musculation de l'anglais vers le français.
- name_fr : le nom FRANÇAIS USUEL en salle de sport (ex. "Barbell Bench Press" → "Développé couché à la barre", "Deadlift" → "Soulevé de terre"). Pas de traduction littérale maladroite.
- instructions_fr : chaque étape traduite naturellement (tutoiement, impératif).
Rends un élément par exercice, avec le même id.

${JSON.stringify(payload)}`,
    });
    usage.input += u?.inputTokens ?? 0;
    usage.output += u?.outputTokens ?? 0;

    for (const t of object.traductions) {
      await client.query(
        "update exercises set name_fr = $1, instructions_fr = $2 where id = $3",
        [t.name_fr, t.instructions_fr, t.id]
      );
    }
    done += batch.length;
    process.stdout.write(`\r${done}/${todo.length} traduits…`);
  } catch (e) {
    console.error(`\n⚠️ Lot ${i / BATCH + 1} en échec (${e.message?.slice(0, 80)}) — on continue.`);
  }
}

console.log(
  `\n✅ Terminé. Tokens : ${usage.input} in / ${usage.output} out (~${(
    (usage.input / 1e6) * 1 +
    (usage.output / 1e6) * 5
  ).toFixed(2)} $)`
);
await client.end();
