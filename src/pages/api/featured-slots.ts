import type { APIRoute } from "astro";
import { fetchBusinesses, isPublished, categoriesOf, hasActivePaidTier, servesTown } from "@/lib/businesses";
import { getCounty, getTownsByCounty } from "@/lib/geo";
import { getCategory } from "@/lib/taxonomy";

const CAP = 3;

/**
 * GET /api/featured-slots?state=nj&county=bergen-county&category=roofers
 * → { ok, cap, taken, open } — the Featured cap is 3 per category per county,
 * counting only published businesses with an active featured/sponsor tier.
 */
export const GET: APIRoute = async ({ url }) => {
  const stateSlug = url.searchParams.get("state") ?? "";
  const countySlug = url.searchParams.get("county") ?? "";
  const categorySlug = url.searchParams.get("category") ?? "";
  const county = getCounty(stateSlug, countySlug);
  const category = getCategory(categorySlug);
  if (!county || !category) {
    return new Response(JSON.stringify({ ok: false, error: "unknown county or category" }), { status: 400 });
  }
  const townSlugs = new Set(getTownsByCounty(stateSlug, countySlug).map((t) => t.slug));
  const all = await fetchBusinesses();
  const taken = all.filter(
    (b) =>
      isPublished(b) &&
      hasActivePaidTier(b) &&
      categoriesOf(b).has(categorySlug) &&
      (b.countySlug === countySlug || [...townSlugs].some((t) => servesTown(b, t))),
  ).length;
  return new Response(
    JSON.stringify({ ok: true, cap: CAP, taken, open: Math.max(0, CAP - taken) }),
    { headers: { "Content-Type": "application/json" } },
  );
};
