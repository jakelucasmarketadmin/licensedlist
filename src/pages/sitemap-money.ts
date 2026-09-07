import type { APIRoute } from "astro";
import { sectionSitemapResponse } from "@/lib/sitemap";

export const GET: APIRoute = async () => await sectionSitemapResponse("money");
