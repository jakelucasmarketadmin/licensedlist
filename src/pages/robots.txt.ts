import type { APIRoute } from "astro";
import { SITE_URL } from "@/lib/site";

/**
 * robots.txt served from the app so the sitemap directive can never drift
 * again — it is derived from SITE_URL, never written as a literal.
 *
 * Wix also serves a dashboard-managed robots.txt; whichever wins, the smoke
 * test asserts the live file has exactly one Sitemap: line pointing at the
 * production /sitemap-index (docs/RUNBOOK.md §16).
 */
export const GET: APIRoute = async () =>
  new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /search",
      "Disallow: /owner",
      "Disallow: /account",
      "Disallow: /saved",
      "Disallow: /*?sort=",
      "Disallow: /*?filter=",
      "Disallow: /*?preview=",
      "",
      "# Block PetalBot",
      "User-agent: PetalBot",
      "Disallow: /",
      "",
      "# Crawl delay for overly enthusiastic bots",
      "User-agent: dotbot",
      "Crawl-delay: 10",
      "User-agent: AhrefsBot",
      "Crawl-delay: 10",
      "",
      `Sitemap: ${SITE_URL}/sitemap-index`,
      "",
    ].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
