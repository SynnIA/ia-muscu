import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { signedPhotoUrls } from "@/lib/photos/storage";
import PhotosView from "@/components/photos/photos-view";

export default async function PhotosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lecture sous RLS ; URLs signées 6 h générées côté serveur (bucket privé)
  const { data } = await supabase
    .from("progress_photos")
    .select("id, taken_at, pose, photo_path")
    .order("taken_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = data ?? [];
  const urls = await signedPhotoUrls(
    rows.map((r) => r.photo_path),
    6 * 3600
  );
  const photos = rows
    .map((r) => ({
      id: r.id as string,
      taken_at: r.taken_at as string,
      pose: r.pose as "face" | "profil" | "dos",
      url: urls.get(r.photo_path) ?? "",
    }))
    .filter((p) => p.url);

  return <PhotosView photos={photos} />;
}
