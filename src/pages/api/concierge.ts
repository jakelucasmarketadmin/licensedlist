import type { APIRoute } from "astro";
import { json, clean, elevatedData } from "@/lib/server-data";
import { hasAi, askClaudeJson } from "@/lib/ai";
import { parseIntent } from "@/lib/intent";
import { fetchBusinesses, isPublished, categoriesOf, blendedRating } from "@/lib/businesses";
import { fetchReviewsFor } from "@/lib/reviews";
import { GUIDE_SEED } from "@/data/guides.generated";
import { getCategory } from "@/lib/taxonomy";
import { getState, getCounty } from "@/lib/geo";

/**
 * "Ask LicensedList" concierge (D3): RAG over OUR OWN data only — listings,
 * guides, on-site reviews, license records. No web browsing. Answers cite the
 * pages the facts came from; a quote request is one suggested action. Rate
 * limited per IP; every exchange logged (question + which sources answered,
 * no user identity). 503 without ANTHROPIC_API_KEY — the drawer isn't even
 * rendered then.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) return true;
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear(); // crude memory guard
  return false;
}

interface Answer {
  answer: string;
  citations: { title: string; path: string }[];
  suggestQuote: boolean;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!hasAi()) return json({ ok: false, error: "concierge unavailable" }, 503);
  if (rateLimited(clientAddress ?? "?")) return json({ ok: false, error: "rate limited — try again in a minute" }, 429);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  const question = clean(body.question, 400);
  if (question.length < 5) return json({ ok: false, error: "ask a fuller question" }, 400);

  // ---- Retrieval (our data only) ----
  const intent = await parseIntent(question);
  const published = (await fetchBusinesses()).filter(isPublished);
  const bizPool = intent.categorySlug
    ? published.filter((b) => categoriesOf(b).has(intent.categorySlug!))
    : published;
  const businesses = bizPool.slice(0, 6);

  const qLower = question.toLowerCase();
  const guides = GUIDE_SEED.filter((g) => {
    const hay = `${g.title} ${g.scopeKey}`.toLowerCase();
    return (
      (intent.stateSlug && g.scope === "state" && g.scopeKey === intent.stateSlug) ||
      (intent.categorySlug && g.scope === "category" && g.scopeKey === intent.categorySlug) ||
      qLower.split(/\s+/).filter((w) => w.length > 4).some((w) => hay.includes(w))
    );
  }).slice(0, 3);

  const reviewSnippets: string[] = [];
  for (const b of businesses.slice(0, 3)) {
    const rs = await fetchReviewsFor(b.slug ?? "");
    for (const r of rs.slice(0, 2))
      reviewSnippets.push(`${b.name} review (${r.rating}★): ${(r.body ?? "").slice(0, 160)}`);
  }

  const context = [
    "LISTINGS:",
    ...businesses.map((b) => {
      const cat = getCategory(b.primaryCategorySlug ?? "")?.name ?? "";
      const rating = blendedRating(b);
      return `- ${b.name} [/business/${b.slug}] — ${cat}, ${b.city}, ${b.state}; license ${b.licenseStatus}${b.licenseNumber ? ` #${b.licenseNumber} (${b.licenseSource})` : ""}${rating ? `; ${rating}★` : ""}${b.responseTimeHours != null ? `; responds ~${b.responseTimeHours}h` : ""}`;
    }),
    guides.length ? "GUIDES:" : "",
    ...guides.map((g) => {
      const path = g.scope === "state" ? `/${g.scopeKey}` : g.scope === "county" ? `/${g.scopeKey}` : `/${g.scopeKey}`;
      return `- ${g.title} [${path}]: ${g.body.slice(0, 350).replace(/\n+/g, " ")}`;
    }),
    reviewSnippets.length ? "REVIEWS:" : "",
    ...reviewSnippets,
  ].filter(Boolean).join("\n");

  const result = await askClaudeJson<Answer>({
    system:
      'You are the concierge for LicensedList, a license-verified local business directory for NJ/NY/PA. Answer ONLY from the provided context — if the context doesn\'t contain the answer, say so plainly and point to the closest page. Keys: answer (3-5 plain sentences, no hype), citations (array of {title, path} — only paths that appear in [brackets] in the context), suggestQuote (true when the user seems ready to hire). Never give legal or medical advice; never invent businesses, prices, or license facts.',
    prompt: `CONTEXT:\n${context.slice(0, 7000)}\n\nQUESTION: ${question}`,
    maxTokens: 500,
  });

  // Log (no user identity — question text only, PII already length-capped;
  // strip digit runs to be safe).
  (async () => {
    try {
      const { insertItem } = await elevatedData();
      await insertItem({
        dataCollectionId: "conciergeLogs",
        dataItem: {
          data: {
            question: question.replace(/\d[\d\s().-]{5,}\d/g, "#"),
            answeredFrom: [
              businesses.length ? `${businesses.length} listings` : null,
              guides.length ? `${guides.length} guides` : null,
              reviewSnippets.length ? `${reviewSnippets.length} reviews` : null,
            ].filter(Boolean).join(", "),
            outcome: result ? "answered" : "model-failed",
          },
        },
      });
    } catch { /* best-effort */ }
  })();

  if (!result?.answer) return json({ ok: false, error: "couldn't answer — try the search instead" }, 502);
  return json({
    ok: true,
    answer: result.answer,
    citations: (result.citations ?? []).filter((c) => c?.path?.startsWith("/")).slice(0, 4),
    suggestQuote: Boolean(result.suggestQuote),
    quotePath: businesses[0] ? `/business/${businesses[0].slug}#quote` : "/categories",
  });
};
