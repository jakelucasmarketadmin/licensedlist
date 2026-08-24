import type { APIRoute } from "astro";
import { sitemapResponse } from "@/lib/sitemap";

export const GET: APIRoute = async () => await sitemapResponse();
