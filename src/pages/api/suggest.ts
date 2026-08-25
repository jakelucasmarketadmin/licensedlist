import type { APIRoute } from "astro";
import { getCategories } from "@/lib/taxonomy";
import { getAllTowns, getCountiesByState, getStates, getTownBySlug } from "@/lib/geo";
import { fetchBusinesses, isPublished } from "@/lib/businesses";

/**
 * Typeahead data for the hero search.
 *
 *   GET /api/suggest?scope=what&q=roo   → { categories: ≤6, businesses: ≤3 }
 *   GET /api/suggest?scope=where&q=hac  → { places: ≤6 }
 *   GET /api/suggest?scope=near&lat=&lng= → { place } (nearest seeded town)
 *
 * Category ranking: name-prefix first, then synonym match, then substring —
 * so "ac" finds HVAC contractors via synonyms before anything containing "ac".
 * Businesses are published records only. Responses cache 5 minutes at the edge.
 */
const CACHE = "public, max-age=300, s-maxage=300";
const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Cache-Control": CACHE },
  });

export const GET: APIRoute = async ({ url }) => {
  const scope = url.searchParams.get("scope") ?? "what";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  if (scope === "near") {
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response(JSON.stringify({ ok: false, error: "bad coords" }), { status: 400 });
    }
    let best: { label: string; d: number } | null = null;
    for (const t of getAllTowns()) {
      const tLat = Number(t.lat), tLng = Number(t.lng);
      if (!Number.isFinite(tLat) || !Number.isFinite(tLng)) continue;
      const d = (tLat - lat) ** 2 + ((tLng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
      if (!best || d < best.d) best = { label: `${t.name}, ${t.stateSlug.toUpperCase()}`, d };
    }
    // No edge cache for personal coordinates.
    return new Response(JSON.stringify({ place: best?.label ?? null }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  if (scope === "where") {
    if (!q) return json({ places: [] });
    const stateAbbr = new Map(getStates().map((s) => [s.slug, s.abbr]));
    const places: { label: string; sublabel: string }[] = [];
    for (const t of getAllTowns()) {
      if (places.length >= 6) break;
      if (t.name.toLowerCase().startsWith(q))
        places.push({
          label: `${t.name}, ${stateAbbr.get(t.stateSlug) ?? t.stateSlug.toUpperCase()}`,
          sublabel: t.countySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        });
    }
    if (places.length < 6) {
      for (const s of getStates()) {
        for (const c of getCountiesByState(s.slug)) {
          if (places.length >= 6) break;
          if (c.name.toLowerCase().startsWith(q))
            places.push({ label: `${c.name}, ${s.abbr}`, sublabel: `${s.name} county` });
        }
      }
    }
    if (places.length < 6) {
      for (const t of getAllTowns()) {
        if (places.length >= 6) break;
        if (!t.name.toLowerCase().startsWith(q) && t.name.toLowerCase().includes(q))
          places.push({
            label: `${t.name}, ${stateAbbr.get(t.stateSlug) ?? t.stateSlug.toUpperCase()}`,
            sublabel: t.countySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          });
      }
    }
    return json({ places });
  }

  // scope=what
  if (!q) return json({ categories: [], businesses: [] });
  const cats = getCategories();
  const prefix = cats.filter((c) => c.name.toLowerCase().startsWith(q));
  const synonymPrefix = cats.filter(
    (c) => !prefix.includes(c) && c.synonyms.some((s) => s.toLowerCase().startsWith(q)),
  );
  const synonymSub = cats.filter(
    (c) =>
      !prefix.includes(c) && !synonymPrefix.includes(c) &&
      c.synonyms.some((s) => s.toLowerCase().includes(q)),
  );
  const substring = cats.filter(
    (c) =>
      !prefix.includes(c) && !synonymPrefix.includes(c) && !synonymSub.includes(c) &&
      c.name.toLowerCase().includes(q),
  );
  const categories = [...prefix, ...synonymPrefix, ...synonymSub, ...substring]
    .slice(0, 6)
    .map((c) => ({ name: c.name, slug: c.slug }));

  let businesses: { name: string; slug: string; town: string }[] = [];
  try {
    businesses = (await fetchBusinesses())
      .filter((b) => isPublished(b) && (b.name ?? "").toLowerCase().includes(q))
      .slice(0, 3)
      .map((b) => {
        const town = b.townSlug ? getTownBySlug(b.townSlug, b.stateSlug) : undefined;
        return {
          name: b.name ?? "",
          slug: b.slug ?? "",
          town: town ? `${town.name}, ${town.stateSlug.toUpperCase()}` : "",
        };
      });
  } catch {
    // CMS hiccup: category suggestions still work.
  }
  return json({ categories, businesses });
};
