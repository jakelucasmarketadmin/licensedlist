import { SITE_URL } from "./site";
import { sitemapPaths } from "./routes";
import { getAllTowns, getStates, getCountiesByState } from "./geo";
import { GEO_DATA_UPDATED } from "@/data/geo.generated";
import { getCategories } from "./taxonomy";
import { getGuide } from "./guides";
import {
  fetchBusinesses,
  isPublished,
  categoriesOf,
  servesTown,
} from "./businesses";

/**
 * Build the sitemap XML. Served at two paths — /sitemap.xml (standard) and
 * /sitemap (fallback): on this Wix deployment *.xml routes 404 at the platform
 * layer, so robots.txt points at /sitemap (set via the dashboard editor).
 *
 * Included: static routes, geo hubs, /categories + category hubs, published
 * business profiles, and geo×category list pages that meet the 3-listing
 * publishing rule. CMS-driven entries fail soft: on query errors the static
 * portion still serves.
 *
 * <lastmod> comes only from real record dates — a guide's updatedAt for the
 * hub it renders on, a business record's _updatedDate for profiles, and the
 * newest member's _updatedDate for qualified list pages. URLs with no dated
 * record omit lastmod entirely; the build time is never used.
 */
interface SitemapEntry {
  path: string;
  lastmod?: string;
}

const toDateOnly = (v: string | Date | undefined): string | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
};
const newest = (...dates: (string | undefined)[]): string | undefined =>
  dates.filter((d): d is string => Boolean(d)).sort().pop();

export async function buildSitemapXml(): Promise<string> {
  const entries: SitemapEntry[] = sitemapPaths().map((e) => ({ path: e.path, lastmod: e.lastmod }));

  // Geo hubs: lastmod from the guide rendered on the page, when one exists.
  const guideDate = (scope: string, scopeKey: string, prefix: string) =>
    toDateOnly(getGuide(scope, scopeKey, prefix)?.updatedAt);
  for (const state of getStates()) {
    entries.push({ path: `/${state.slug}`, lastmod: newest(guideDate("state", state.slug, "licensing-"), GEO_DATA_UPDATED) });
    for (const county of getCountiesByState(state.slug)) {
      entries.push({ path: `/${county.pathKey}`, lastmod: newest(guideDate("county", county.pathKey, "cost-context-"), GEO_DATA_UPDATED) });
    }
  }
  // Town hubs: the geo/photo seed's newest CSV mtime is the real change date.
  for (const town of getAllTowns()) entries.push({ path: `/${town.pathKey}`, lastmod: GEO_DATA_UPDATED });

  for (const category of getCategories()) {
    entries.push({
      path: `/${category.slug}`,
      lastmod: newest(
        guideDate("category", category.slug, "hiring-"),
        guideDate("category", category.slug, "cost-context-"),
        GEO_DATA_UPDATED,
      ),
    });
  }

  try {
    const businesses = (await fetchBusinesses()).filter(isPublished);
    for (const b of businesses) {
      entries.push({ path: `/business/${b.slug}`, lastmod: toDateOnly((b as any)._updatedDate) });
    }

    // Geo×category list pages with >=3 published listings; lastmod = newest member update.
    const townCat = new Map<string, { count: number; lastmod?: string }>();
    for (const b of businesses) {
      const cats = categoriesOf(b);
      const updated = toDateOnly((b as any)._updatedDate);
      for (const town of getAllTowns()) {
        if (b.stateSlug !== town.stateSlug || !servesTown(b, town.slug)) continue;
        for (const cat of cats) {
          const key = `${town.pathKey}|${cat}`;
          const entry = townCat.get(key) ?? { count: 0 };
          entry.count += 1;
          entry.lastmod = newest(entry.lastmod, updated);
          townCat.set(key, entry);
        }
      }
    }
    for (const [key, { count, lastmod }] of townCat) {
      if (count >= 3) {
        const [pathKey, cat] = key.split("|");
        entries.push({ path: `/${pathKey}/${cat}`, lastmod });
      }
    }
  } catch (err) {
    console.error("sitemap business entries failed", err);
  }

  // De-dup on path, preferring the entry that carries a lastmod.
  const byPath = new Map<string, SitemapEntry>();
  for (const entry of entries) {
    const existing = byPath.get(entry.path);
    if (!existing || (!existing.lastmod && entry.lastmod)) byPath.set(entry.path, entry);
  }

  const urls = [...byPath.values()]
    .map(({ path, lastmod }) => {
      const loc = `${SITE_URL}${path === "/" ? "/" : path}`;
      return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function sitemapResponse(): Promise<Response> {
  return new Response(await buildSitemapXml(), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
