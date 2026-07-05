import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { createClient } from "@/lib/db/server";
import { INFO_PROMPT, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { buildUserSummary } from "@/lib/ai/summary";
import { buildTools } from "@/lib/ai/tools";

export const maxDuration = 60;

/** Extrait le texte brut d'un UIMessage (pour la colonne `content`). */
function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

export async function POST(req: Request) {
  // Auth obligatoire + garde mono-utilisateur
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Non authentifié", { status: 401 });
  }
  const allowed = process.env.ALLOWED_EMAIL;
  if (allowed && user.email !== allowed) {
    return new Response("Accès refusé", { status: 403 });
  }

  const { messages, mode }: { messages: UIMessage[]; mode?: "info" | "question" } =
    await req.json();
  // Mode INFO (toggle 📝) : on logge, on ne coache pas — prompt minimal,
  // dernier message uniquement, sous-ensemble de tools, réponse ultra-courte.
  const infoMode = mode === "info";

  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  // Image jointe au message en cours → stockée par log_meal si c'est un repas (P6c)
  const pendingImage =
    lastUser?.parts.find(
      (p): p is Extract<typeof p, { type: "file" }> =>
        p.type === "file" && !!p.mediaType?.startsWith("image/")
    )?.url ?? null;

  const today = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeZone: "Europe/Paris",
  }).format(new Date());

  // Mode Question : la « vue sur tout » — état des lieux 4 mois calculé par le code
  const summary = infoMode ? "" : await buildUserSummary(supabase, user.id);

  const allTools = buildTools(supabase, user.id, { pendingImage });
  const tools = infoMode
    ? {
        log_weight: allTools.log_weight,
        log_meal: allTools.log_meal,
        log_workout: allTools.log_workout,
        log_activity: allTools.log_activity,
        remember_fact: allTools.remember_fact,
        search_food: allTools.search_food,
        lookup_barcode: allTools.lookup_barcode,
      }
    : allTools;

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    // AI SDK v7 : les blocs system passent par `instructions` (interdits dans `messages`)
    instructions: [
      {
        // Bloc 1 — PRÉFIXE STABLE (prompt + connaissances) : point de cache.
        // Les tools sont rendus avant le system → couverts par ce breakpoint.
        role: "system",
        content: infoMode ? INFO_PROMPT : SYSTEM_PROMPT,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      {
        // Bloc 2 — contexte volatil, APRÈS le point de cache.
        role: "system",
        content: `Date du jour : ${today} (Europe/Paris).${summary ? `\n\n${summary}` : ""}`,
      },
    ],
    messages: await convertToModelMessages(
      infoMode && lastUser ? [lastUser] : messages
    ),
    tools,
    stopWhen: stepCountIs(5), // laisse le modèle enchaîner tool → réponse
    maxOutputTokens: infoMode ? 300 : 1024, // réponses courtes = coût maîtrisé
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ responseMessage }) => {
      // Persistance de la conversation (mémoire durable)
      const rows = [];
      if (lastUser) {
        rows.push({
          user_id: user.id,
          role: "user" as const,
          content: textOf(lastUser),
          parts: lastUser.parts,
        });
      }
      rows.push({
        user_id: user.id,
        role: "assistant" as const,
        content: textOf(responseMessage),
        parts: responseMessage.parts,
      });
      await supabase.from("messages").insert(rows);
    },
  });
}
