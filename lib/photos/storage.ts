import "server-only";
import { createAdminClient } from "@/lib/db/admin";

/**
 * Accès au bucket privé `photos` (physique : <uid>/physique/…, repas : <uid>/meals/…).
 * ⚠️ Passe par le client ADMIN (aucune policy storage nécessaire) : chaque appelant
 * DOIT avoir vérifié l'auth et que le path appartient bien à l'utilisateur.
 */
export const PHOTOS_BUCKET = "photos";

/** Décode une data URL image en Buffer + content-type. */
export function decodeImageDataUrl(
  dataUrl: string
): { buffer: Buffer; contentType: string } | null {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  return { buffer: Buffer.from(m[2], "base64"), contentType: m[1] };
}

/** Upload d'une data URL dans le bucket. Renvoie le path, ou null si échec. */
export async function uploadImageDataUrl(
  path: string,
  dataUrl: string
): Promise<string | null> {
  const decoded = decodeImageDataUrl(dataUrl);
  if (!decoded) return null;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(PHOTOS_BUCKET)
    .upload(path, decoded.buffer, {
      contentType: decoded.contentType,
      upsert: false,
    });
  return error ? null : path;
}

/** URL signée de lecture (1 h par défaut). */
export async function signedPhotoUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(path, expiresIn);
  return error ? null : data.signedUrl;
}

/** URLs signées en lot → Map<path, url>. */
export async function signedPhotoUrls(
  paths: string[],
  expiresIn = 3600
): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrls(paths, expiresIn);
  const map = new Map<string, string>();
  for (const d of data ?? []) {
    if (d.signedUrl && d.path) map.set(d.path, d.signedUrl);
  }
  return map;
}

/** Supprime un objet du bucket. */
export async function deletePhoto(path: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(PHOTOS_BUCKET).remove([path]);
  return !error;
}
