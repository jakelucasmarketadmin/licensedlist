import type { APIRoute } from "astro";
import { json, clean } from "@/lib/server-data";
import { searchRegistered } from "@/lib/registry";
import { getCategory } from "@/lib/taxonomy";

/**
 * "Search all {N}" for the registry table (R-fix 2). Read-only, public,
 * name-only matching, capped at 50 rows — no PII beyond the public roster
 * fields already rendered server-side.
 */
export const GET: APIRoute = async ({ url }) => {
  const stateSlug = clean(url.searchParams.get("state"), 10);
  const countySlug = clean(url.searchParams.get("county"), 60);
  const categorySlug = clean(url.searchParams.get("category"), 60) || undefined;
  const q = clean(url.searchParams.get("q"), 80);
  if (!stateSlug || !countySlug || q.length < 2)
    return json({ ok: false, error: "state, county, and a 2+ char q are required" }, 400);

  const rows = await searchRegistered({ stateSlug, countySlug, categorySlug }, q, 50);
  return new Response(
    JSON.stringify({
      ok: true,
      rows: rows.map((r) => ({
        name: r.name,
        city: r.city,
        address1: r.address1 ?? "",
        zip: r.zip ?? "",
        licenseNumber: r.licenseNumber,
        licenseExpiresAt: r.licenseExpiresAt ?? "",
        category: getCategory(r.primaryCategorySlug ?? "")?.name ?? "",
      })),
    }),
    { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } },
  );
};
