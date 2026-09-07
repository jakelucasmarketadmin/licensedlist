import type { APIRoute } from "astro";
import { fetchBusinesses, isPublished, blendedRating, totalReviewCount } from "@/lib/businesses";
import { getCategory } from "@/lib/taxonomy";
import { SITE_URL } from "@/lib/site";

/**
 * Read-only machine endpoint (D4): every published listing's public facts.
 * No PII beyond what already renders on public pages (business phone is the
 * business's public contact). Documented on /ai-info and in llms.txt.
 */
export const GET: APIRoute = async () => {
  const published = (await fetchBusinesses()).filter(isPublished);
  const body = {
    source: "LicensedList — license-verified local business directory (NJ/NY/PA)",
    generatedAt: new Date().toISOString(),
    docs: `${SITE_URL}/ai-info`,
    listings: published.map((b) => ({
      name: b.name,
      url: `${SITE_URL}/business/${b.slug}`,
      category: getCategory(b.primaryCategorySlug ?? "")?.name ?? null,
      city: b.city,
      state: b.state,
      licenseStatus: b.licenseStatus,
      licenseNumber: b.licenseStatus === "verified" ? b.licenseNumber : null,
      licenseSource: b.licenseStatus === "verified" ? b.licenseSource : null,
      licenseVerifiedAt: b.licenseVerifiedAt ?? null,
      rating: blendedRating(b),
      reviewCount: totalReviewCount(b),
      phone: b.phone ?? null,
      website: b.website ?? null,
    })),
  };
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
};
