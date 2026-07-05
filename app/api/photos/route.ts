import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { deletePhoto, uploadImageDataUrl } from "@/lib/photos/storage";

/** Upload + suppression des photos de progression physique (bucket privé). */

const PostSchema = z.object({
  photo: z.string().regex(/^data:image\//, "data URL image attendue"),
  pose: z.enum(["face", "profil", "dos"]),
  taken_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, res: new Response("Non authentifié", { status: 401 }) };
  const allowed = process.env.ALLOWED_EMAIL;
  if (allowed && user.email !== allowed) {
    return { supabase, user: null, res: new Response("Accès refusé", { status: 403 }) };
  }
  return { supabase, user, res: null };
}

export async function POST(req: Request) {
  const { supabase, user, res } = await requireUser();
  if (!user) return res!;

  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Entrée invalide" }, { status: 400 });
  }
  const { photo, pose, taken_at } = parsed.data;

  const path = await uploadImageDataUrl(
    `${user.id}/physique/${taken_at}-${pose}-${crypto.randomUUID().slice(0, 8)}.jpg`,
    photo
  );
  if (!path) return Response.json({ error: "Échec de l'upload" }, { status: 500 });

  // Insert via la session utilisateur → RLS
  const { data: row, error } = await supabase
    .from("progress_photos")
    .insert({ user_id: user.id, taken_at, pose, photo_path: path })
    .select("id")
    .single();
  if (error || !row) {
    await deletePhoto(path); // pas de fichier orphelin
    return Response.json({ error: error?.message ?? "Insertion impossible" }, { status: 500 });
  }
  return Response.json({ ok: true, id: row.id });
}

export async function DELETE(req: Request) {
  const { supabase, user, res } = await requireUser();
  if (!user) return res!;

  const id = new URL(req.url).searchParams.get("id");
  if (!id || !z.uuid().safeParse(id).success) {
    return Response.json({ error: "id invalide" }, { status: 400 });
  }

  // Lecture sous RLS : garantit que la photo appartient bien à l'utilisateur
  const { data: row } = await supabase
    .from("progress_photos")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!row) return Response.json({ error: "Introuvable" }, { status: 404 });

  const { error } = await supabase.from("progress_photos").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await deletePhoto(row.photo_path);
  return Response.json({ ok: true });
}
