import { BaseCrudService } from "@/integrations";
import { getTownsByCounty } from "@/lib/geo";

/**
 * Directory business record — collection ID `businesses`.
 * Field keys follow docs/ARCHITECTURE.md; the Vibe-era demo items in the same
 * collection lack `status`/`slug` and are filtered out of every query.
 */
export interface DirectoryBusiness {
  _id: string;
  name?: string;
  slug?: string;
  /** draft | published | suspended */
  status?: string;
  /** free | verified | featured | sponsor */
  tier?: string;
  isClient?: boolean | string;
  claimed?: boolean | string;
  primaryCategorySlug?: string;
  /** comma list */
  categorySlugs?: string;
  stateSlug?: string;
  countySlug?: string;
  townSlug?: string;
  /** comma list */
  serviceTownSlugs?: string;
  pathKey?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  email?: string;
  description?: string;
  whyWePicked?: string;
  yearsInBusiness?: number;
  foundedYear?: number;
  services?: string;
  /** JSON object {"mon":"8:00-17:00",...} */
  hoursJson?: string;
  logoUrl?: string;
  /** comma list or JSON array of image URLs */
  photosJson?: string;
  /** verified | unverified | not-required | suspended */
  licenseStatus?: string;
  licenseNumber?: string;
  licenseSource?: string;
  licenseVerifiedAt?: string | Date;
  insuredStatus?: string;
  ratingGoogle?: number;
  ratingGoogleCount?: number;
  ratingYelp?: number;
  ratingYelpCount?: number;
  ratingFacebook?: number;
  ratingFacebookCount?: number;
  responseTimeHours?: number;
  /** Featured tier expiry — past this date the tier no longer renders. */
  featuredUntil?: string | Date;
  lastVerifiedAt?: string | Date;
  sourceNotes?: string;
}

const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const truthy = (v: unknown) => v === true || v === "true";

export const isDemo = (b: DirectoryBusiness) => (b.sourceNotes ?? "").includes("DEMO");
export const isPublished = (b: DirectoryBusiness) => b.status === "published";
/** Preview mode also renders clearly-labeled DEMO drafts (noindex pages only). */
export const isPreviewable = (b: DirectoryBusiness) =>
  isPublished(b) || (b.status === "draft" && isDemo(b));

export const categoriesOf = (b: DirectoryBusiness) => {
  const cats = new Set(list(b.categorySlugs));
  if (b.primaryCategorySlug) cats.add(b.primaryCategorySlug);
  return cats;
};

export const servesTown = (b: DirectoryBusiness, townSlug: string) =>
  b.townSlug === townSlug || list(b.serviceTownSlugs).includes(townSlug);

export const totalReviewCount = (b: DirectoryBusiness) =>
  (b.ratingGoogleCount ?? 0) + (b.ratingYelpCount ?? 0) + (b.ratingFacebookCount ?? 0);

export const blendedRating = (b: DirectoryBusiness): number | null => {
  const parts: [number, number][] = [];
  if (b.ratingGoogle && b.ratingGoogleCount) parts.push([b.ratingGoogle, b.ratingGoogleCount]);
  if (b.ratingYelp && b.ratingYelpCount) parts.push([b.ratingYelp, b.ratingYelpCount]);
  if (b.ratingFacebook && b.ratingFacebookCount)
    parts.push([b.ratingFacebook, b.ratingFacebookCount]);
  const n = parts.reduce((s, [, c]) => s + c, 0);
  if (!n) return null;
  return Math.round((parts.reduce((s, [r, c]) => s + r * c, 0) / n) * 10) / 10;
};

/**
 * The transparent organic score (documented on /how-we-verify), in priority
 * order: license verified, review count, rating, freshness of verification.
 * Payment, claimed status, and agency relationships have zero weight.
 */
export function organicCompare(a: DirectoryBusiness, b: DirectoryBusiness): number {
  const lic = Number(b.licenseStatus === "verified") - Number(a.licenseStatus === "verified");
  if (lic) return lic;
  const reviews = totalReviewCount(b) - totalReviewCount(a);
  if (reviews) return reviews;
  const rating = (blendedRating(b) ?? 0) - (blendedRating(a) ?? 0);
  if (rating) return rating;
  const fresh =
    new Date(b.lastVerifiedAt ?? 0).getTime() - new Date(a.lastVerifiedAt ?? 0).getTime();
  return fresh;
}

/** "Google & Yelp"-style label naming only the platforms with data. */
export function ratingSourcesLabel(b: DirectoryBusiness): string {
  const sources = [
    b.ratingGoogle && b.ratingGoogleCount ? "Google" : null,
    b.ratingYelp && b.ratingYelpCount ? "Yelp" : null,
    b.ratingFacebook && b.ratingFacebookCount ? "Facebook" : null,
  ].filter((s): s is string => Boolean(s));
  if (sources.length <= 1) return sources[0] ?? "";
  return `${sources.slice(0, -1).join(", ")} & ${sources[sources.length - 1]}`;
}

/** Featured/sponsor tier counts only while featuredUntil (if set) is in the future. */
export const hasActivePaidTier = (b: DirectoryBusiness) =>
  (b.tier === "featured" || b.tier === "sponsor") &&
  (!b.featuredUntil || new Date(b.featuredUntil).getTime() > Date.now());

export const isSponsoredPlacement = (b: DirectoryBusiness) =>
  hasActivePaidTier(b) || truthy(b.isClient);

let cache: { at: number; items: DirectoryBusiness[] } | null = null;
const CACHE_MS = 60_000;

export async function fetchBusinesses(): Promise<DirectoryBusiness[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
  try {
    const result: any = await BaseCrudService.getAll("businesses", {}, { limit: 1000 });
    const items: DirectoryBusiness[] = Array.isArray(result) ? result : (result?.items ?? []);
    // Only records with the directory schema count at all.
    const valid = items.filter((b) => b.slug && b.status);
    cache = { at: Date.now(), items: valid };
    return valid;
  } catch (err) {
    console.error("businesses fetch failed", err);
    return cache?.items ?? [];
  }
}

export interface ListingSet {
  /** Labeled paid placements, max 3 — never affects the organic list. */
  featured: DirectoryBusiness[];
  /** Every qualifying business, ordered by the transparent score. */
  organic: DirectoryBusiness[];
}

function toListingSet(matches: DirectoryBusiness[]): ListingSet {
  const organic = [...matches].sort(organicCompare);
  const featured = matches
    .filter(hasActivePaidTier)
    .sort((a, b) => {
      const tier = Number(b.tier === "sponsor") - Number(a.tier === "sponsor");
      return tier || organicCompare(a, b);
    })
    .slice(0, 3);
  return { featured, organic };
}

const inScope = (preview: boolean) => (b: DirectoryBusiness) =>
  preview ? isPreviewable(b) : isPublished(b);

export async function listForTownCategory(
  townSlug: string,
  categorySlug: string,
  preview = false,
): Promise<ListingSet> {
  const all = await fetchBusinesses();
  return toListingSet(
    all.filter(
      (b) => inScope(preview)(b) && servesTown(b, townSlug) && categoriesOf(b).has(categorySlug),
    ),
  );
}

export async function listForCountyCategory(
  stateSlug: string,
  countySlug: string,
  categorySlug: string,
  preview = false,
): Promise<ListingSet> {
  const all = await fetchBusinesses();
  const townSlugs = new Set(getTownsByCounty(stateSlug, countySlug).map((t) => t.slug));
  return toListingSet(
    all.filter(
      (b) =>
        inScope(preview)(b) &&
        categoriesOf(b).has(categorySlug) &&
        (b.countySlug === countySlug ||
          list(b.serviceTownSlugs).some((t) => townSlugs.has(t))),
    ),
  );
}

export async function listForStateCategory(
  stateSlug: string,
  categorySlug: string,
  preview = false,
): Promise<ListingSet> {
  const all = await fetchBusinesses();
  return toListingSet(
    all.filter(
      (b) => inScope(preview)(b) && b.stateSlug === stateSlug && categoriesOf(b).has(categorySlug),
    ),
  );
}

export async function getBusinessBySlug(
  slug: string,
  preview = false,
): Promise<DirectoryBusiness | undefined> {
  const all = await fetchBusinesses();
  return all.find((b) => b.slug === slug && inScope(preview)(b));
}

/** Category slugs with ≥ min published businesses serving the given town. */
export async function qualifiedCategoriesForTown(townSlug: string, min = 3): Promise<Map<string, number>> {
  const all = await fetchBusinesses();
  const counts = new Map<string, number>();
  for (const b of all) {
    if (!isPublished(b) || !servesTown(b, townSlug)) continue;
    for (const cat of categoriesOf(b)) counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return new Map([...counts].filter(([, n]) => n >= min));
}
