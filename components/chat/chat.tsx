"use client";

import { useChat } from "@ai-sdk/react";
import type { FileUIPart, UIMessage } from "ai";
import {
  Dumbbell,
  ImagePlus,
  LogOut,
  Mic,
  SendHorizontal,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/client";
import { resizeToDataUrl } from "@/lib/images";
import ChartRenderer, { type ChartOutput } from "@/components/charts/chart-renderer";

const TOOL_LABELS: Record<string, string> = {
  generate_chart: "Graphique généré",
  log_weight: "Poids enregistré",
  log_meal: "Repas enregistré",
  log_workout: "Séance enregistrée",
  log_activity: "Activité enregistrée",
  get_history: "Historique consulté",
  remember_fact: "Noté pour plus tard",
  recall_facts: "Mémoire consultée",
  update_profile: "Profil mis à jour",
  calc_needs: "Besoins calculés",
  estimate_1rm: "1RM estimé",
  search_food: "CIQUAL consulté",
  search_exercise: "Exercices consultés",
  lookup_barcode: "Produit scanné",
  get_knowledge: "Fiche scientifique",
};

/* ----- Web Speech API (gratuit, navigateur) — types minimaux ----- */
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Lit un texte à voix haute (fr-FR), en retirant emojis et markdown légers. */
function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const clean = text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[*_#`]/g, "")
    .trim();
  if (!clean) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "fr-FR";
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

export default function Chat({
  initialMessages,
}: {
  initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  // Mode 📝 Info (log éclair, IA dégraissée) / 💬 Question (vrai coach) — persisté
  const [mode, setMode] = useState<"info" | "question">("info");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  // --- Voix : dictée (micro) + lecture des réponses ---
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Détection navigateur post-hydratation (SSR ne connaît ni window ni localStorage)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicSupported(getSpeechRecognition() !== null);
    setSpeakEnabled(localStorage.getItem("ia-muscu:speak") === "1");
    const savedMode = localStorage.getItem("ia-muscu:mode");
    if (savedMode === "info" || savedMode === "question") setMode(savedMode);
  }, []);

  function switchMode(next: "info" | "question") {
    setMode(next);
    localStorage.setItem("ia-muscu:mode", next);
  }

  const toggleSpeak = useCallback(() => {
    setSpeakEnabled((v) => {
      const next = !v;
      localStorage.setItem("ia-muscu:speak", next ? "1" : "0");
      if (!next) window.speechSynthesis?.cancel();
      return next;
    });
  }, []);

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = getSpeechRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = Array.from({ length: e.results.length })
        .map((_, i) => e.results[i][0]?.transcript ?? "")
        .join(" ")
        .trim();
      setInput(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  // Lit la dernière réponse quand le streaming se termine (si activé)
  useEffect(() => {
    if (status !== "ready" || !speakEnabled) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (lastSpokenIdRef.current === last.id) return;
    lastSpokenIdRef.current = last.id;
    const text = last.parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join(" ");
    speak(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, speakEnabled]);

  // Au chargement : ne pas relire l'historique
  useEffect(() => {
    const last = initialMessages[initialMessages.length - 1];
    if (last) lastSpokenIdRef.current = last.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingImage(await resizeToDataUrl(file));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && !pendingImage) || busy) return;

    const files: FileUIPart[] = pendingImage
      ? [{ type: "file", mediaType: "image/jpeg", url: pendingImage }]
      : [];

    sendMessage({ text: text || "Voici une photo.", files }, { body: { mode } });
    setInput("");
    setPendingImage(null);
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-lime-400/10 ring-1 ring-lime-400/30">
            <Dumbbell className="size-4 text-lime-400" />
          </div>
          <h1 className="font-semibold text-zinc-100">La Forge</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSpeak}
            aria-label={speakEnabled ? "Couper la lecture vocale" : "Activer la lecture vocale"}
            className={`rounded-lg p-2 transition hover:bg-zinc-900 ${
              speakEnabled ? "text-lime-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {speakEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
          <button
            onClick={logout}
            aria-label="Se déconnecter"
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-300"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-lg font-medium text-zinc-300">Salut ! 💪</p>
            <p className="max-w-xs text-sm text-zinc-500">
              Dis-moi ce que tu as fait aujourd&apos;hui, envoie une photo de
              ton repas, ou demande ta séance du jour.
            </p>
          </div>
        )}

        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "self-end max-w-[85%] rounded-2xl rounded-br-md bg-lime-400 px-4 py-2.5 text-sm text-zinc-950"
                  : "self-start max-w-[85%] rounded-2xl rounded-bl-md bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 ring-1 ring-zinc-800"
              }
            >
              {message.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <p key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </p>
                  );
                }
                if (part.type === "file" && part.mediaType?.startsWith("image/")) {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={part.url}
                      alt="photo envoyée"
                      className="my-1 max-h-56 rounded-xl"
                    />
                  );
                }
                if (part.type.startsWith("tool-")) {
                  const toolName = part.type.slice(5);
                  // Graphique : rendu inline quand le résultat est disponible
                  if (
                    toolName === "generate_chart" &&
                    "state" in part &&
                    part.state === "output-available" &&
                    "output" in part
                  ) {
                    return (
                      <ChartRenderer key={i} output={part.output as ChartOutput} />
                    );
                  }
                  return (
                    <span
                      key={i}
                      className="my-1 flex w-fit items-center gap-1.5 rounded-full bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-400"
                    >
                      <Wrench className="size-3" />
                      {TOOL_LABELS[toolName] ?? toolName}
                    </span>
                  );
                }
                return null;
              })}
            </div>
          ))}

          {status === "submitted" && (
            <div className="self-start rounded-2xl rounded-bl-md bg-zinc-900 px-4 py-3 ring-1 ring-zinc-800">
              <span className="flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]" />
              </span>
            </div>
          )}

          {error && (
            <p className="self-center text-sm text-red-400">
              Erreur : {error.message}
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-800/80 px-4 py-3"
      >
        {/* Toggle Info / Question — Info = log éclair pas cher, Question = vrai coach */}
        <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2">
          <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-0.5">
            {(
              [
                ["info", "📝 Info"],
                ["question", "💬 Question"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`rounded-[10px] px-3 py-1.5 text-xs transition ${
                  mode === m
                    ? "bg-lime-400 font-medium text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-zinc-500">
            {mode === "info" ? "J'enregistre, réponse éclair" : "Ton coach te répond"}
          </span>
        </div>
        {pendingImage && (
          <div className="mx-auto mb-2 flex max-w-2xl">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage}
                alt="aperçu"
                className="h-20 rounded-xl object-cover"
              />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                aria-label="Retirer la photo"
                className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        )}
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickImage}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Ajouter une photo"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:text-lime-400"
          >
            <ImagePlus className="size-5" />
          </button>
          {micSupported && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? "Arrêter la dictée" : "Dicter un message"}
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition ${
                listening
                  ? "animate-pulse border-lime-400/60 bg-lime-400/10 text-lime-400"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-lime-400"
              }`}
            >
              <Mic className="size-5" />
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "info"
                ? "Raconte : séance, repas, poids…"
                : "Pose ta question au coach…"
            }
            enterKeyHint="send"
            className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || (!input.trim() && !pendingImage)}
            aria-label="Envoyer"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-zinc-950 transition hover:bg-lime-300 disabled:opacity-40"
          >
            <SendHorizontal className="size-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
