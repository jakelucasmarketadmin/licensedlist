import type { APIRoute } from "astro";
import { json, clean, elevatedData } from "@/lib/server-data";
import { parseIntent, matchIntent, stripPii } from "@/lib/intent";
import { getCategory } from "@/lib/taxonomy";
import { getTownBySlug } from "@/lib/geo";

/**
 * NL intake (D2): POST {text, preview?} → parsed intent + matched pros with
 * "why this matches" + criteria checkmarks. Falls back to the rules parser
 * without ANTHROPIC_API_KEY. Logs parsed intent WITHOUT PII (raw text is
 * never stored; unmatched terms are PII-stripped tokens) to `intentLogs` for
 * the synonyms improvement report (scripts/intent-synonyms-report.ts).
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  const text = clean(body.text, 600);
  if (text.length < 8) return json({ ok: false, error: "tell us a bit more" }, 400);
  const preview = body.preview === true;

  const intent = await parseIntent(text);
  const matches = await matchIntent(intent, preview);

  // Fire-and-forget intent log — parsed fields only, never the raw text.
  (async () => {
    try {
      const { insertItem } = await elevatedData();
      await insertItem({
        dataCollectionId: "intentLogs",
        dataItem: {
          data: {
            query: "", // deliberately empty — no raw text stored (PII rule)
            parsedJson: JSON.stringify({
              categorySlug: intent.categorySlug,
              subservices: intent.subservices,
              townSlug: intent.townSlug,
              stateSlug: intent.stateSlug,
              urgency: intent.urgency,
              budgetHint: intent.budgetHint ? stripPii(intent.budgetHint) : null,
              unmatchedTerms: intent.unmatchedTerms,
              confidence: intent.confidence,
            }),
            matchedCategory: intent.categorySlug ?? "",
            matchedTown: intent.townSlug ?? "",
            source: intent.source,
            outcome: matches.length ? `matched-${matches.length}` : "no-matches",
          },
        },
      });
    } catch { /* logging is best-effort */ }
  })();

  const categoryName = intent.categorySlug ? getCategory(intent.categorySlug)?.name : null;
  const town = intent.townSlug && intent.stateSlug ? getTownBySlug(intent.townSlug, intent.stateSlug) : null;
  return json({
    ok: true,
    intent: {
      category: categoryName,
      town: town?.name ?? null,
      urgency: intent.urgency,
      budgetHint: intent.budgetHint,
      confidence: intent.confidence,
      source: intent.source,
    },
    matches,
    fallbackPath:
      intent.categorySlug && town
        ? `/${town.pathKey}/${intent.categorySlug}`
        : intent.categorySlug
          ? `/${intent.categorySlug}`
          : "/categories",
  });
};
