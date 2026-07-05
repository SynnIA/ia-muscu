import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Open Food Facts — lookup par code-barres avec cache agressif en base
 * (les fiches produit changent peu ; on évite de marteler l'API gratuite).
 * Licence ODbL — attribution requise dans l'app.
 */

const OFF_URL = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS = "product_name,brands,nutriments";
const USER_AGENT = "IA-Muscu-Perso/1.0 (app de suivi personnel)";
const CACHE_TTL_DAYS = 90;

export type OffProduct = {
  barcode: string;
  name: string | null;
  brand: string | null;
  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
};

export async function lookupBarcode(
  supabase: SupabaseClient,
  barcode: string
): Promise<{ ok: true; product: OffProduct; from: "cache" | "api" } | { ok: false; error: string }> {
  // 1) Cache
  const { data: cached } = await supabase
    .from("off_cache")
    .select("barcode, name, brand, kcal_100g, protein_100g, carbs_100g, fat_100g, fetched_at")
    .eq("barcode", barcode)
    .maybeSingle();

  if (cached) {
    const ageDays = (Date.now() - new Date(cached.fetched_at).getTime()) / 86_400_000;
    if (ageDays < CACHE_TTL_DAYS) {
      return { ok: true, product: cached as OffProduct, from: "cache" };
    }
  }

  // 2) API
  let json: {
    status?: number;
    product?: {
      product_name?: string;
      brands?: string;
      nutriments?: Record<string, number>;
    };
  };
  try {
    const res = await fetch(`${OFF_URL}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return { ok: false, error: `OFF HTTP ${res.status}` };
    json = await res.json();
  } catch {
    return { ok: false, error: "Open Food Facts injoignable" };
  }

  if (json.status !== 1 || !json.product) {
    return { ok: false, error: "Produit introuvable dans Open Food Facts" };
  }

  const n = json.product.nutriments ?? {};
  const product: OffProduct = {
    barcode,
    name: json.product.product_name ?? null,
    brand: json.product.brands ?? null,
    kcal_100g: n["energy-kcal_100g"] ?? null,
    protein_100g: n["proteins_100g"] ?? null,
    carbs_100g: n["carbohydrates_100g"] ?? null,
    fat_100g: n["fat_100g"] ?? null,
  };

  // 3) Mise en cache (upsert best-effort)
  await supabase.from("off_cache").upsert({
    ...product,
    raw: json.product,
    fetched_at: new Date().toISOString(),
  });

  return { ok: true, product, from: "api" };
}
