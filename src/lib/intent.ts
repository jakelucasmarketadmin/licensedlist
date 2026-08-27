import { getCategories, getCategory } from "@/lib/taxonomy";
import { getAllTowns } from "@/lib/geo";
import {
  fetchBusinesses,
  isPreviewable,
  isPublished,
  servesTown,
  categoriesOf,
  blendedRating,
  organicCompare,
  type DirectoryBusiness,
} from "@/lib/businesses";
import { askClaudeJson, hasAi } from "@/lib/ai";

/**
 * Natural-language intake (D2): text → {category, subservices, town, urgency,
 * budgetHint} → matched pros with per-criterion checkmarks. Claude parses when
 * ANTHROPIC_API_KEY is set; a synonym/keyword matcher covers the rest — the
 * feature never renders broken, it just parses less.
 */

export interface ParsedIntent {
  categorySlug: string | null;
  subservices: string[];
  townSlug: string | null;
  stateSlug: string | null;
  urgency: "emergency" | "this-week" | "this-month" | "flexible" | null;
  budgetHint: string | null;
  /** taxonomy-unmatched tokens (lowercased, PII-stripped) for the synonyms report */
  unmatchedTerms: string[];
  confidence: "high" | "medium" | "low";
  source: "ai" | "rules";
}

const STOPWORDS = new Set(
  "i my we our a an the and or of to in for on with need needs needed want looking help please can someone is are it its this that have has get near me around at by from asap now house home apartment yard".split(" "),
);

/** Strip likely PII before anything is logged: digits runs, emails, urls. */
export function stripPii(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\d[\d\s().-]{5,}\d/g, " ") // phone-ish digit runs
    .replace(/\b\d{1,5}\s+[A-Za-z]+\s+(st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive|ct|court)\b/gi, " ");
}

function rulesParse(text: string): ParsedIntent {
  const clean = stripPii(text).toLowerCase();
  const tokens = clean.split(/[^a-z0-9'-]+/).filter((t) => t && !STOPWORDS.has(t));

  // Category: exact synonym/name phrase hits first, then token overlap.
  let categorySlug: string | null = null;
  let best = 0;
  for (const c of getCategories()) {
    const phrases = [c.name.toLowerCase(), c.slug.replace(/-/g, " "), ...c.synonyms.map((s) => s.toLowerCase())];
    let score = 0;
    for (const p of phrases) {
      if (!p) continue;
      if (clean.includes(p)) score = Math.max(score, p.split(" ").length * 3);
      else {
        const ptoks = p.split(/\s+/);
        const hit = ptoks.filter((t) => tokens.includes(t)).length;
        if (hit === ptoks.length && ptoks.length > 0) score = Math.max(score, ptoks.length);
      }
    }
    if (score > best) { best = score; categorySlug = c.slug; }
  }

  // Town: longest name match wins (state-scoped slugs).
  let townSlug: string | null = null;
  let stateSlug: string | null = null;
  let townLen = 0;
  for (const t of getAllTowns()) {
    const n = t.name.toLowerCase();
    if (n.length > townLen && clean.includes(n)) {
      townSlug = t.slug;
      stateSlug = t.stateSlug;
      townLen = n.length;
    }
  }

  const urgency = /emergen|urgent|asap|right away|tonight|immediately|burst|flood|no heat|no hot water/.test(clean)
    ? "emergency"
    : /this week|few days|soon/.test(clean)
      ? "this-week"
      : /this month|next month|few weeks/.test(clean)
        ? "this-month"
        : null;

  const budgetMatch = text.match(/\$\s?[\d,]+(?:\s?(?:-|to)\s?\$?\s?[\d,]+)?|budget\s+of\s+[\w$,]+/i);

  const matchedVocab = new Set<string>();
  if (categorySlug) {
    const c = getCategory(categorySlug)!;
    for (const p of [c.name, c.slug.replace(/-/g, " "), ...c.synonyms])
      for (const t of p.toLowerCase().split(/\s+/)) matchedVocab.add(t);
  }
  const unmatchedTerms = tokens.filter((t) => !matchedVocab.has(t) && !/\d/.test(t)).slice(0, 12);

  return {
    categorySlug,
    subservices: [],
    townSlug,
    stateSlug,
    urgency,
    budgetHint: budgetMatch ? budgetMatch[0] : null,
    unmatchedTerms,
    confidence: categorySlug && townSlug ? "high" : categorySlug ? "medium" : "low",
    source: "rules",
  };
}

export async function parseIntent(text: string): Promise<ParsedIntent> {
  const rules = rulesParse(text);
  if (!hasAi()) return rules;

  const categories = getCategories().map((c) => c.slug).join(", ");
  const ai = await askClaudeJson<{
    categorySlug: string | null;
    subservices: string[];
    town: string | null;
    urgency: string | null;
    budgetHint: string | null;
  }>({
    system:
      "You extract a home-services request into JSON with keys categorySlug (one of the provided slugs or null), subservices (array of short strings), town (the town/city name mentioned or null), urgency (emergency|this-week|this-month|flexible|null), budgetHint (string or null). Never invent a town or category that isn't clearly implied.",
    prompt: `Category slugs: ${categories}\n\nRequest: ${stripPii(text).slice(0, 600)}`,
    maxTokens: 300,
  });
  if (!ai) return rules;

  // Resolve the AI's town name against our geo (state-scoped slugs).
  let townSlug = rules.townSlug;
  let stateSlug = rules.stateSlug;
  if (ai.town) {
    const needle = ai.town.toLowerCase().replace(/,.*$/, "").trim();
    const town = getAllTowns().find((t) => t.name.toLowerCase() === needle);
    if (town) { townSlug = town.slug; stateSlug = town.stateSlug; }
  }
  const categorySlug = ai.categorySlug && getCategory(ai.categorySlug) ? ai.categorySlug : rules.categorySlug;

  return {
    categorySlug,
    subservices: Array.isArray(ai.subservices) ? ai.subservices.slice(0, 6).map(String) : [],
    townSlug,
    stateSlug,
    urgency: (["emergency", "this-week", "this-month", "flexible"].includes(ai.urgency ?? "") ? ai.urgency : rules.urgency) as ParsedIntent["urgency"],
    budgetHint: ai.budgetHint ?? rules.budgetHint,
    unmatchedTerms: rules.unmatchedTerms,
    confidence: categorySlug && townSlug ? "high" : categorySlug ? "medium" : "low",
    source: "ai",
  };
}

// ---- Matching ---------------------------------------------------------------

export interface IntentMatch {
  slug: string;
  name: string;
  city: string;
  state: string;
  rating: number | null;
  why: string;
  criteria: { label: string; met: boolean }[];
}

export async function matchIntent(intent: ParsedIntent, preview = false): Promise<IntentMatch[]> {
  if (!intent.categorySlug) return [];
  const all = (await fetchBusinesses()).filter(preview ? isPreviewable : isPublished);
  const inCategory = all.filter((b) => categoriesOf(b).has(intent.categorySlug!));
  const scoped = intent.townSlug
    ? inCategory.filter((b) => b.stateSlug === intent.stateSlug && servesTown(b, intent.townSlug!))
    : inCategory;
  const pool = scoped.length ? scoped : inCategory;

  const catName = getCategory(intent.categorySlug)?.name ?? intent.categorySlug;
  return [...pool]
    .sort(organicCompare)
    .slice(0, 5)
    .map((b: DirectoryBusiness) => {
      const servesHere = intent.townSlug
        ? b.stateSlug === intent.stateSlug && servesTown(b, intent.townSlug)
        : false;
      const rating = blendedRating(b);
      const fastResponder = b.responseTimeHours != null && b.responseTimeHours < 24;
      const services = (b.services ?? "").toLowerCase();
      const subHits = intent.subservices.filter((s) => services.includes(s.toLowerCase()));
      const criteria = [
        { label: catName, met: true },
        ...(intent.townSlug ? [{ label: "serves your town", met: servesHere }] : []),
        { label: "license verified", met: b.licenseStatus === "verified" },
        { label: "responds < 24h", met: fastResponder },
        ...(rating !== null ? [{ label: `${rating}★ rated`, met: rating >= 4.5 }] : []),
        ...subHits.map((s) => ({ label: s, met: true })),
      ];
      const why = [
        b.licenseStatus === "verified" ? "license-verified" : null,
        subHits.length ? `does ${subHits[0]}` : `${catName.toLowerCase().replace(/s$/, "")}`,
        servesHere ? "serving your town" : b.city ? `based in ${b.city}` : null,
        intent.urgency === "emergency" && services.includes("emergency") ? "offers emergency service" : null,
      ]
        .filter(Boolean)
        .join(", ");
      return {
        slug: b.slug ?? "",
        name: b.name ?? "",
        city: b.city ?? "",
        state: b.state ?? "",
        rating,
        why: why.charAt(0).toUpperCase() + why.slice(1),
        criteria,
      };
    });
}
