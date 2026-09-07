import type { APIRoute } from "astro";
import { sitemapIndexResponse } from "@/lib/sitemap";

/** Wix hard-404s *.xml routes, so the index lives at an extensionless path. */
export const GET: APIRoute = async () => await sitemapIndexResponse();
