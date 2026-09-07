import { SITE_URL } from "./site";
import { sitemapPaths } from "./routes";
import { getAllTowns, getStates, getCountiesByState, getTownsByCounty } from "./geo";
import { GEO_DATA_UPDATED } from "@/data/geo.generated";
import { getCategories } from "./taxonomy";
import { getGuide } from "./guides";
import { computeIndexability } from "./indexability";
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
export type SitemapSection =
  | "core" | "geo" | "categories" | "money" | "listings" | "editorial";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  section: SitemapSection;
}

const toDateOnly = (v: string | Date | undefined): string | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
};
const newest = (...dates: (string | undefined)[]): string | undefined =>
  dates.filter((d): d is string => Boolean(d)).sort().pop();

async function collectSitemapEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = sitemapPaths().map((e) => ({
    path: e.path,
    lastmod: e.lastmod,
    section: e.path.startsWith("/guides") ? "editorial" : "core",
  }));

  // Gate B §3.1: thin hubs stay out until they earn a place. The same
  // computation drives the noindex meta on the page itself.
  const allBusinesses = (await fetchBusinesses()).filter(isPublished);
  const idx = computeIndexability(allBusinesses);

  // Geo hubs: lastmod from the guide rendered on the page, when one exists.
  const guideDate = (scope: string, scopeKey: string, prefix: string) =>
    toDateOnly(getGuide(scope, scopeKey, prefix)?.updatedAt);
  for (const state of getStates()) {
    entries.push({ path: `/${state.slug}`, section: "geo", lastmod: newest(guideDate("state", state.slug, "licensing-"), GEO_DATA_UPDATED) });
    for (const county of getCountiesByState(state.slug)) {
      entries.push({ path: `/${county.pathKey}`, section: "geo", lastmod: newest(guideDate("county", county.pathKey, "cost-context-"), GEO_DATA_UPDATED) });
    }
  }
  // Town hubs: the geo/photo seed's newest CSV mtime is the real change date.
  for (const town of getAllTowns()) {
    if (!idx.towns.has(town.pathKey)) continue; // thin town hub — noindexed
    entries.push({ path: `/${town.pathKey}`, section: "geo", lastmod: GEO_DATA_UPDATED });
  }

  for (const category of getCategories()) {
    if (!idx.categories.has(category.slug)) continue; // no listings, no guide
    entries.push({
      path: `/${category.slug}`,
      section: "categories",
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
      entries.push({ path: `/business/${b.slug}`, section: "listings", lastmod: toDateOnly((b as any)._updatedDate) });
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
        entries.push({ path: `/${pathKey}/${cat}`, section: "money", lastmod });
      }
    }

    // County×category list pages use the same >=3 rule as the route itself
    // (member = home county OR serves a town in the county).
    const countyCat = new Map<string, { count: number; lastmod?: string }>();
    for (const state of getStates()) {
      for (const county of getCountiesByState(state.slug)) {
        const townSlugs = new Set(getTownsByCounty(state.slug, county.slug).map((t) => t.slug));
        for (const b of businesses) {
          if (b.stateSlug !== state.slug) continue;
          const inCounty =
            b.countySlug === county.slug ||
            [...townSlugs].some((t) => servesTown(b, t));
          if (!inCounty) continue;
          const updated = toDateOnly((b as any)._updatedDate);
          for (const cat of categoriesOf(b)) {
            const key = `${county.pathKey}|${cat}`;
            const entry = countyCat.get(key) ?? { count: 0 };
            entry.count += 1;
            entry.lastmod = newest(entry.lastmod, updated);
            countyCat.set(key, entry);
          }
        }
      }
    }
    for (const [key, { count, lastmod }] of countyCat) {
      if (count >= 3) {
        const [pathKey, cat] = key.split("|");
        entries.push({ path: `/${pathKey}/${cat}`, section: "money", lastmod });
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

  return [...byPath.values()];
}

/** The flat sitemap kept at /sitemap for continuity with robots.txt and GSC. */
export async function buildSitemapXml(): Promise<string> {
  const urls = (await collectSitemapEntries())
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

export const SITEMAP_SECTIONS: SitemapSection[] = [
  "core", "geo", "categories", "money", "listings", "editorial",
];

const xmlResponse = (body: string) =>
  new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });

/** One section's urlset — this is what makes GSC a per-template dashboard. */
export async function sectionSitemapResponse(section: SitemapSection): Promise<Response> {
  const entries = (await collectSitemapEntries()).filter((e) => e.section === section);
  const urls = entries
    .map(({ path, lastmod }) =>
      `  <url><loc>${SITE_URL}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`)
    .join("\n");
  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
}

/** The index. lastmod per section = newest real lastmod inside it. */
export async function sitemapIndexResponse(): Promise<Response> {
  const entries = await collectSitemapEntries();
  const parts = SITEMAP_SECTIONS.map((section) => {
    const inSection = entries.filter((e) => e.section === section);
    if (!inSection.length) return null;
    const lastmod = newest(...inSection.map((e) => e.lastmod));
    return `  <sitemap><loc>${SITE_URL}/sitemap-${section}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</sitemap>`;
  }).filter(Boolean);
  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.join("\n")}\n</sitemapindex>\n`,
  );
}
