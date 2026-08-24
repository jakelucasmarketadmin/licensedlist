import { SITE_URL } from "./site";
import { sitemapPaths } from "./routes";
import { hubPaths, getAllTowns } from "./geo";
import { getCategories } from "./taxonomy";
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
 */
export async function buildSitemapXml(): Promise<string> {
  const paths: string[] = [
    ...sitemapPaths(),
    ...hubPaths(),
    ...getCategories().map((c) => `/${c.slug}`),
  ];

  try {
    const businesses = (await fetchBusinesses()).filter(isPublished);
    for (const b of businesses) paths.push(`/business/${b.slug}`);

    // Geo×category list pages with >=3 published listings.
    const townCat = new Map<string, number>(); // "pathKey|cat" -> count
    for (const b of businesses) {
      const cats = categoriesOf(b);
      for (const town of getAllTowns()) {
        if (!servesTown(b, town.slug)) continue;
        for (const cat of cats) {
          const key = `${town.pathKey}|${cat}`;
          townCat.set(key, (townCat.get(key) ?? 0) + 1);
        }
      }
    }
    for (const [key, count] of townCat) {
      if (count >= 3) {
        const [pathKey, cat] = key.split("|");
        paths.push(`/${pathKey}/${cat}`);
      }
    }
  } catch (err) {
    console.error("sitemap business entries failed", err);
  }

  const urls = [...new Set(paths)]
    .map((path) => `  <url><loc>${SITE_URL}${path === "/" ? "/" : path}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function sitemapResponse(): Promise<Response> {
  return new Response(await buildSitemapXml(), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
