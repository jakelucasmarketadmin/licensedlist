import { BaseCrudService } from "@/integrations";
import type { DirectoryBusiness } from "@/lib/businesses";

/**
 * On-site review system — collections `reviews` and `servicePrices`.
 *
 * The public Q&A was removed 2026-09-07: answering questions needs a per-business
 * inbox we don't run, so profiles link straight to the business's own phone and
 * email instead. The `questions` collection is retained with its existing rows.
 *
 * Reads run with elevated permissions server-side (the collections are not
 * publicly readable because pending items carry reviewer emails); the harness
 * has no @wix runtime, so every fetch falls back to BaseCrudService, which the
 * harness stub can point at fixtures.
 *
 * FTC posture (docs/REVIEWS.md): invitations go to every won lead, no
 * sentiment gating; `verifiedHire` is set server-side only when the review
 * arrived through a one-time lead token; `aggregateRating` JSON-LD comes only
 * from published on-site reviews and only at ≥3.
 */

export interface SiteReview {
  _id: string;
  businessSlug?: string;
  reviewerName?: string;
  /** Kept for moderation contact — never rendered. */
  reviewerEmail?: string;
  rating?: number;
  body?: string;
  jobType?: string;
  /** JSON {"quality":5,"communication":4,"value":5,"timeliness":4} (1–5 each). */
  aspectsJson?: string | Record<string, number>;
  /** JSON array of photo URLs. */
  photosJson?: string | string[];
  /** true only when submitted via a one-time token from a won lead. */
  verifiedHire?: boolean | string;
  /** trivetted (token flow) | public | owner-imported */
  source?: string;
  /** pending | published | rejected */
  moderationStatus?: string;
  ownerResponse?: string;
  ownerRespondedAt?: string | Date;
  leadId?: string;
  townName?: string;
  _createdDate?: string | Date;
}

export interface ServicePrice {
  _id: string;
  businessSlug?: string;
  service?: string;
  /** e.g. "$95–$250", "from $8,500", "free estimate" — display string, no math. */
  priceLabel?: string;
  unit?: string;
  note?: string;
  sortOrder?: number;
}


export const ASPECT_KEYS = ["quality", "communication", "value", "timeliness"] as const;
export const ASPECT_LABELS: Record<(typeof ASPECT_KEYS)[number], string> = {
  quality: "Quality",
  communication: "Communication",
  value: "Value",
  timeliness: "Timeliness",
};

const truthy = (v: unknown) => v === true || v === "true";

export const isVerifiedHire = (r: SiteReview) => truthy(r.verifiedHire);
export const isPublishedReview = (r: SiteReview) => r.moderationStatus === "published";

export function reviewAspects(r: SiteReview): Partial<Record<string, number>> {
  const raw = r.aspectsJson;
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const k of ASPECT_KEYS) {
      const v = Number((parsed as any)[k]);
      if (Number.isFinite(v) && v >= 1 && v <= 5) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function reviewPhotos(r: SiteReview): string[] {
  const raw = r.photosJson;
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed)
      ? parsed.filter((p) => typeof p === "string" && p.startsWith("http"))
      : [];
  } catch {
    return [];
  }
}

/** Elevated getAll with a plain BaseCrudService fallback (harness fixtures). */
async function fetchAll<T>(collectionId: string): Promise<T[]> {
  try {
    const { auth } = await import("@wix/essentials");
    const data: any = await import("@wix/data");
    // Elevate the SDK function itself (see lib/server-data.ts gotcha).
    const q: any = auth.elevate(data.items.query);
    const res: any = await q(collectionId).limit(1000).find();
    return (res?.items ?? []).map((it: any) => ({ _id: it._id ?? it.id, ...(it.data ?? it) }));
  } catch {
    try {
      const result: any = await BaseCrudService.getAll(collectionId, {}, { limit: 1000 });
      return Array.isArray(result) ? result : (result?.items ?? []);
    } catch {
      return [];
    }
  }
}

const cache = new Map<string, { at: number; items: unknown[] }>();
const CACHE_MS = 60_000;

async function cachedAll<T>(collectionId: string): Promise<T[]> {
  const hit = cache.get(collectionId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items as T[];
  const items = await fetchAll<T>(collectionId);
  // Never cache an empty fetch over previous data (transient failures).
  if (items.length || !hit) cache.set(collectionId, { at: Date.now(), items });
  return items.length || !hit ? items : (hit.items as T[]);
}

/** Published reviews for one business, newest first. */
export async function fetchReviewsFor(slug: string): Promise<SiteReview[]> {
  const all = await cachedAll<SiteReview>("reviews");
  return all
    .filter((r) => r.businessSlug === slug && isPublishedReview(r))
    .sort(
      (a, b) => new Date(b._createdDate ?? 0).getTime() - new Date(a._createdDate ?? 0).getTime(),
    );
}

export async function fetchServicePricesFor(slug: string): Promise<ServicePrice[]> {
  const all = await cachedAll<ServicePrice>("servicePrices");
  return all
    .filter((p) => p.businessSlug === slug && p.service)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
}

// ---- Derived display data ---------------------------------------------------

export function siteAverage(reviews: SiteReview[]): number | null {
  const rated = reviews.map((r) => Number(r.rating)).filter((n) => n >= 1 && n <= 5);
  if (!rated.length) return null;
  return Math.round((rated.reduce((s, n) => s + n, 0) / rated.length) * 10) / 10;
}

export function aspectAverages(reviews: SiteReview[]): { key: string; label: string; avg: number; count: number }[] {
  return ASPECT_KEYS.map((key) => {
    const vals = reviews.map((r) => reviewAspects(r)[key]).filter((v): v is number => v != null);
    return {
      key,
      label: ASPECT_LABELS[key],
      avg: vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : 0,
      count: vals.length,
    };
  }).filter((a) => a.count > 0);
}

/** [count of 5★, 4★, 3★, 2★, 1★] */
export function ratingHistogram(reviews: SiteReview[]): number[] {
  const buckets = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    const n = Math.round(Number(r.rating));
    if (n >= 1 && n <= 5) buckets[5 - n]++;
  }
  return buckets;
}

const STOPWORDS = new Set(
  "the a an and or of to in for on with was were is are they them he she it we our my this that very really so had has have did does done great good".split(" "),
);

/**
 * Keyword chips: service phrases actually mentioned in review text, ranked by
 * mention count (Yelp "Popular offerings" pattern). Falls back to the first
 * services when there is no review text yet.
 */
export function popularServices(
  b: Pick<DirectoryBusiness, "services">,
  reviews: SiteReview[],
  max = 6,
): { label: string; mentions: number }[] {
  const services = (b.services ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!services.length) return [];
  const corpus = reviews.map((r) => (r.body ?? "").toLowerCase()).join(" \n ");
  const scored = services.map((s) => {
    const tokens = s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOPWORDS.has(t));
    let mentions = 0;
    if (corpus) {
      if (corpus.includes(s.toLowerCase())) {
        mentions = corpus.split(s.toLowerCase()).length - 1 + 2; // exact phrase weighs extra
      } else if (tokens.length) {
        const hits = tokens.filter((t) => corpus.includes(t)).length;
        if (hits === tokens.length) mentions = 1;
      }
    }
    return { label: s, mentions };
  });
  const mentioned = scored.filter((s) => s.mentions > 0).sort((a, b) => b.mentions - a.mentions);
  const rest = scored.filter((s) => s.mentions === 0);
  return [...mentioned, ...rest].slice(0, max);
}

// ---- Highlights -------------------------------------------------------------

/** Vocabulary for the `highlights` comma-list field on businesses. */
export const HIGHLIGHT_DEFS: Record<string, { label: string; icon: string }> = {
  "licensed": { label: "Licensed & registry-checked", icon: "ShieldCheck" },
  "insured": { label: "Insured", icon: "FirstAid" },
  "family-owned": { label: "Family-owned", icon: "HouseLine" },
  "third-generation": { label: "Third-generation", icon: "Tree" },
  "emergency-service": { label: "24/7 emergency service", icon: "Lightning" },
  "free-estimates": { label: "Free estimates", icon: "Calculator" },
  "locally-owned": { label: "Locally owned", icon: "Storefront" },
  "eco-friendly": { label: "Eco-friendly practices", icon: "Plant" },
  "warranty": { label: "Workmanship warranty", icon: "Toolbox" },
  "financing": { label: "Financing available", icon: "ChartLineUp" },
  "background-checked": { label: "Background-checked team", icon: "Eye" },
  "award-winning": { label: "Award-winning", icon: "Sparkle" },
};

export function highlightsOf(b: { highlights?: string }): { key: string; label: string; icon: string }[] {
  return (b.highlights ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((k) => k && HIGHLIGHT_DEFS[k])
    .map((k) => ({ key: k, ...HIGHLIGHT_DEFS[k] }));
}
