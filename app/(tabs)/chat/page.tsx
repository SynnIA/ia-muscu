import { redirect } from "next/navigation";
import type { UIMessage } from "ai";
import { createClient } from "@/lib/db/server";
import Chat from "@/components/chat/chat";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Recharge les derniers échanges (mémoire de conversation)
  const { data: rows } = await supabase
    .from("messages")
    .select("id, role, content, parts")
    .order("created_at", { ascending: false })
    .limit(30);

  const initialMessages: UIMessage[] = (rows ?? [])
    .reverse()
    .map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      parts: (row.parts as UIMessage["parts"]) ?? [
        { type: "text", text: row.content ?? "" },
      ],
    }));

  return <Chat initialMessages={initialMessages} />;
}
