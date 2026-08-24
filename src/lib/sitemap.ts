import { SITE_URL } from "./site";
import { sitemapPaths } from "./routes";

/**
 * Build the sitemap XML. One shared builder because the sitemap is served at
 * two paths — /sitemap.xml (standard) and /sitemap (fallback): on some Wix
 * deployments *.xml routes 404 at the platform layer (seen on other sites in
 * this fleet), so robots.txt gets pointed at whichever resolves in production.
 */
export function buildSitemapXml(): string {
  const urls = sitemapPaths()
    .map((path) => {
      const loc = `${SITE_URL}${path === "/" ? "/" : path}`;
      return `  <url><loc>${loc}</loc></url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function sitemapResponse(): Response {
  return new Response(buildSitemapXml(), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
