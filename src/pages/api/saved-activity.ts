import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";
import { fetchBusinesses, isPublished, blendedRating } from "@/lib/businesses";
import { fetchReviewsFor } from "@/lib/reviews";
import { offersForBusiness } from "@/lib/offers";
import { getCategory } from "@/lib/taxonomy";

/**
 * /saved page data (D1): POST {slugs[]} → card data + recent activity (new
 * on-site reviews, active offers) for those saved businesses. Public data
 * only — everything returned already renders on public pages.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  const slugs: string[] = (Array.isArray(body.slugs) ? body.slugs : [])
    .map((s: unknown) => String(s).slice(0, 120))
    .slice(0, 50);
  if (!slugs.length) return json({ ok: true, businesses: [] });

  const all = (await fetchBusinesses()).filter(isPublished);
  const monthAgo = Date.now() - 30 * 86400e3;
  const businesses = [];
  for (const slug of slugs) {
    const b = all.find((x) => x.slug === slug);
    if (!b) continue;
    const [reviews, offers] = await Promise.all([fetchReviewsFor(slug), offersForBusiness(slug)]);
    const newReviews = reviews.filter((r) => new Date(r._createdDate ?? 0).getTime() > monthAgo);
    businesses.push({
      slug,
      name: b.name,
      city: b.city,
      state: b.state,
      category: getCategory(b.primaryCategorySlug ?? "")?.name ?? "",
      rating: blendedRating(b),
      licenseStatus: b.licenseStatus,
      phone: b.phone ?? "",
      activity: [
        ...newReviews.slice(0, 2).map((r) => ({ kind: "review", text: `New ${r.rating}★ review: “${(r.body ?? "").slice(0, 90)}…”` })),
        ...offers.slice(0, 2).map((o) => ({ kind: "offer", text: `Deal: ${o.title}` })),
      ],
    });
  }
  return json({ ok: true, businesses });
};
