import { askClaudeJson, hasAi, hashInput } from "@/lib/ai";
import type { SiteReview } from "@/lib/reviews";

/**
 * "What customers say" (D3) — AI summary of a profile's published on-site
 * reviews with aspect sentiment and CLICK-THROUGH: every claim carries the
 * review ids that support it. Cached in the `aiSummaries` collection keyed by
 * a content hash, so it regenerates only when the review set changes. Hidden
 * under 3 reviews; absent entirely without ANTHROPIC_API_KEY. Labeled
 * AI-generated in the UI.
 */

export interface ReviewSummary {
  overall: string;
  aspects: { aspect: string; sentiment: "positive" | "mixed" | "negative"; note: string; reviewIds: string[] }[];
}

async function elevated() {
  const { auth } = await import("@wix/essentials");
  const data: any = await import("@wix/data");
  return {
    q: auth.elevate(data.items.query) as any,
    insert: auth.elevate(data.items.insert) as any,
    remove: auth.elevate(data.items.remove) as any,
  };
}

export async function reviewSummaryFor(
  businessSlug: string,
  reviews: SiteReview[],
): Promise<ReviewSummary | null> {
  if (reviews.length < 3 || !hasAi()) return null;
  const inputHash = hashInput(
    reviews.map((r) => `${r._id}|${r.rating}|${(r.body ?? "").slice(0, 80)}`).sort().join("\n"),
  );

  let tools;
  try {
    tools = await elevated();
    const cached: any = await tools.q("aiSummaries")
      .eq("businessSlug", businessSlug)
      .eq("kind", "reviews")
      .find();
    const hit = (cached?.items ?? []).find((it: any) => (it.data ?? it).inputHash === inputHash);
    if (hit) {
      try {
        return JSON.parse((hit.data ?? hit).summaryJson) as ReviewSummary;
      } catch { /* regenerate below */ }
    }
  } catch {
    tools = null; // no elevation (harness) — generate uncached if key exists
  }

  const validIds = new Set(reviews.map((r) => r._id));
  const corpus = reviews
    .map((r) => `[${r._id}] ${r.rating}★ ${r.jobType ?? ""}: ${(r.body ?? "").slice(0, 400)}`)
    .join("\n");
  const summary = await askClaudeJson<ReviewSummary>({
    system:
      'Summarize customer reviews for a local-services profile. JSON keys: overall (2 sentences, balanced, plain language), aspects (array of {aspect: one of "Quality"|"Communication"|"Value"|"Timeliness", sentiment: "positive"|"mixed"|"negative", note: one short sentence, reviewIds: the ids in [brackets] that support the note}). Only include aspects the reviews actually discuss. Never invent claims; every note must be supported by the cited reviews.',
    prompt: corpus.slice(0, 6000),
    maxTokens: 600,
  });
  if (!summary || !summary.overall || !Array.isArray(summary.aspects)) return null;
  summary.aspects = summary.aspects
    .filter((a) => a && a.aspect && a.note)
    .map((a) => ({ ...a, reviewIds: (a.reviewIds ?? []).filter((id) => validIds.has(id)) }));

  if (tools) {
    try {
      // Replace any stale cache rows for this business.
      const stale: any = await tools.q("aiSummaries")
        .eq("businessSlug", businessSlug)
        .eq("kind", "reviews")
        .find();
      for (const it of stale?.items ?? []) await tools.remove("aiSummaries", it._id ?? it.id);
      await tools.insert("aiSummaries", {
        businessSlug,
        kind: "reviews",
        summaryJson: JSON.stringify(summary),
        inputHash,
        reviewCount: reviews.length,
      });
    } catch { /* cache write is best-effort */ }
  }
  return summary;
}
