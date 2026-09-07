import type { APIRoute } from "astro";
import { GUIDE_SEED } from "@/data/guides.generated";
import { SITE_URL } from "@/lib/site";

/** Read-only machine endpoint (D4): guide metadata + host page URLs. */
export const GET: APIRoute = async () => {
  const body = {
    source: "LicensedList editorial guides — sourced, human-reviewed",
    generatedAt: new Date().toISOString(),
    docs: `${SITE_URL}/ai-info`,
    guides: GUIDE_SEED.map((g) => ({
      title: g.title,
      hostPage: `${SITE_URL}/${g.scopeKey}`,
      scope: g.scope,
      author: g.author,
      aiAssisted: g.aiAssisted,
      updatedAt: g.updatedAt || g.publishedAt,
    })),
  };
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
};
