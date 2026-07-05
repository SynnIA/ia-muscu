/**
 * Redimensionne une image côté client (canvas) en data URL JPEG.
 * Utilisé partout où on envoie une image (vision IA, upload storage) :
 * coût vision + poids réseau maîtrisés.
 */
export async function resizeToDataUrl(
  source: File | Blob,
  maxPx = 1280,
  quality = 0.8
): Promise<string> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}
