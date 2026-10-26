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
  /** JSON of day->hours. The CMS field is JSON-typed, so reads may return an object. */
  hoursJson?: string | Record<string, string>;
  logoUrl?: string;
  /** comma list or JSON array of image URLs */
  /** JSON array of photo URLs; JSON-typed CMS reads may return the array itself. */
  photosJson?: string | string[];
  /** verified | unverified | not-required | credential-only | suspended */
  licenseStatus?: string;
  licenseNumber?: string;
  licenseSource?: string;
  /** Who holds the license when it isn't the business itself (e.g. a med spa's medical director). */
  licenseHolder?: string;
  /** JSON array of further verified licenses: [{label, number, source, verifiedAt}]. */
  additionalLicensesJson?: string;
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
  /** client | public-records | self-submitted | registry */
  listingSource?: string;
  /** When the listed-you notice email went out (unclaimed tier). */
  notifiedAt?: string | Date;
  /** Removal request honored — the importer must never re-add this record. */
  optOutAt?: string | Date;
  /** Comma list from the HIGHLIGHT_DEFS vocabulary (lib/reviews.ts). */
  highlights?: string;
  /** Singular search term ("barber") that replaces the category name in the
   * profile's <title> and meta description, where the category label is plural
   * or compound ("Hair Salons & Barbers"). */
  seoLabel?: string;
  /** JSON array [{title, town, date, description, photos: [], beforePhoto?, afterPhoto?}]. */
  projectsJson?: string | ProjectEntry[];
  /** JSON array [{name, role, bio?, photo?}]. */
  teamJson?: string | TeamMember[];
  /** JSON array [{q, a}]. */
  faqJson?: string | FaqEntry[];
}

export interface ProjectEntry {
  title: string;
  town?: string;
  date?: string;
  description?: string;
  photos?: string[];
  beforePhoto?: string;
  afterPhoto?: string;
}

export interface TeamMember {
  name: string;
  role?: string;
  bio?: string;
  photo?: string;
}

export interface FaqEntry {
  q: string;
  a: string;
}

/** Parse a JSON-array field that CMS reads may return as string or array. */
function parseJsonArray<T>(raw: string | T[] | undefined, valid: (x: any) => boolean): T[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter(valid) : [];
  } catch {
    return [];
  }
}

export const projectsOf = (b: DirectoryBusiness) =>
  parseJsonArray<ProjectEntry>(b.projectsJson, (p) => p && typeof p.title === "string");
export const teamOf = (b: DirectoryBusiness) =>
  parseJsonArray<TeamMember>(b.teamJson, (m) => m && typeof m.name === "string");
export const faqOf = (b: DirectoryBusiness) =>
  parseJsonArray<FaqEntry>(b.faqJson, (f) => f && typeof f.q === "string" && typeof f.a === "string");
export const photosOf = (b: DirectoryBusiness) =>
  parseJsonArray<string>(b.photosJson, (p) => typeof p === "string" && p.startsWith("http"));

const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const truthy = (v: unknown) => v === true || v === "true";

/**
 * US ZIP, normalised for display and for structured data.
 *
 * The CMS stores some ZIPs as numbers, which silently eats the leading zero —
 * every New Jersey ZIP starts with 0, so "07656" came back as 7656 and
 * rendered as "Park Ridge, NJ 7656" on every NJ listing and in every
 * PostalAddress. Left-pad to five characters; pass ZIP+4 through untouched.
 */
export function formatZip(zip: unknown): string {
  const raw = String(zip ?? "").trim();
  if (!raw) return "";
  const plus4 = raw.match(/^(\d{1,5})-(\d{4})$/);
  if (plus4) return `${plus4[1].padStart(5, "0")}-${plus4[2]}`;
  if (/^\d{1,5}$/.test(raw)) return raw.padStart(5, "0");
  return raw; // already non-numeric (or foreign) — leave it alone
}

export const isDemo = (b: DirectoryBusiness) => (b.sourceNotes ?? "").includes("DEMO");

/** Unclaimed public-records tier: full profile + threshold credit, but
 * labeled "Unclaimed", no quote form, and a standing claim/remove banner. */
export const isUnclaimed = (b: DirectoryBusiness) =>
  b.listingSource === "public-records" && !truthy(b.claimed);

/** The public-safe provenance line: the leading "Compiled from …" sentence of
 * sourceNotes (the rest is operator notes and never renders). */
export function publicSources(b: DirectoryBusiness): string | null {
  // First sentence of sourceNotes; a period only ends it before whitespace or
  // end-of-string so domains like example.com survive intact.
  const m = (b.sourceNotes ?? "").match(/^Compiled from .*?\.(?=\s|$)/);
  return m ? m[0] : null;
}

/** "as reported by …" for third-party ratings on unclaimed listings. */
export function ratingReportedVia(b: DirectoryBusiness): string {
  const m = (b.sourceNotes ?? "").match(/Rating (?:via|from) ([^.(]+)/i);
  return m ? m[1].trim() : "the business's public profiles";
}
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

// Count only sources that also carry a rating, so the number always matches
// the "across {sources}" label (a stray count without a rating is ignored).
export const totalReviewCount = (b: DirectoryBusiness) =>
  (b.ratingGoogle ? Number(b.ratingGoogleCount ?? 0) || 0 : 0) +
  (b.ratingYelp ? Number(b.ratingYelpCount ?? 0) || 0 : 0) +
  (b.ratingFacebook ? Number(b.ratingFacebookCount ?? 0) || 0 : 0);

export const blendedRating = (b: DirectoryBusiness): number | null => {
  const parts: [number, number][] = [];
  if (b.ratingGoogle && b.ratingGoogleCount) parts.push([Number(b.ratingGoogle), Number(b.ratingGoogleCount)]);
  if (b.ratingYelp && b.ratingYelpCount) parts.push([Number(b.ratingYelp), Number(b.ratingYelpCount)]);
  if (b.ratingFacebook && b.ratingFacebookCount)
    parts.push([Number(b.ratingFacebook), Number(b.ratingFacebookCount)]);
  const n = parts.reduce((s, [, c]) => s + c, 0);
  if (!n) return null;
  return Math.round((parts.reduce((s, [r, c]) => s + r * c, 0) / n) * 10) / 10;
};

/**
 * The transparent organic score (documented on /how-we-verify), in priority
 * order: license verified, review count, rating, freshness of verification.
 * Payment, claimed status, and agency relationships have zero weight.
 */
export interface AdditionalLicense {
  label?: string;
  number: string;
  source?: string;
  verifiedAt?: string;
}

/**
 * Human label for a licenseStatus value. "credential-only" means the premises
 * has no license of its own on file and what we verified is a named
 * individual's personal credential — recorded, but never badged as a business
 * license (docs/VERIFICATION.md).
 */
export function licenseStatusLabel(status?: string): string {
  switch (status) {
    case "verified": return "verified";
    case "not-required": return "not required for this category";
    case "credential-only": return "credential on file (no facility license)";
    case "suspended": return "suspended";
    case "unverified": return "not verified";
    default: return status ?? "unknown";
  }
}

/** Parse the additional-licenses field; malformed JSON yields []. */
export function additionalLicenses(b: DirectoryBusiness): AdditionalLicense[] {
  if (!b.additionalLicensesJson) return [];
  try {
    const parsed = JSON.parse(b.additionalLicensesJson);
    return Array.isArray(parsed) ? parsed.filter((l) => l && l.number) : [];
  } catch {
    return [];
  }
}

/** Parse hoursJson whether the CMS returns a JSON string or an object. */
export function parseHours(b: DirectoryBusiness): Record<string, string> | null {
  const raw = b.hoursJson;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function organicCompare(a: DirectoryBusiness, b: DirectoryBusiness): number {
  const lic = Number(b.licenseStatus === "verified") - Number(a.licenseStatus === "verified");
  if (lic) return lic;
  const reviews = totalReviewCount(b) - totalReviewCount(a);
  if (reviews) return reviews;
  const rating = (blendedRating(b) ?? 0) - (blendedRating(a) ?? 0);
  if (rating) return rating;
  // Documented factor (see /how-we-verify): at equal score, a CLAIMED listing
  // outranks an unclaimed public-records listing — a claimed listing has a
  // business standing behind its information.
  const claimed = Number(!isUnclaimed(b)) - Number(!isUnclaimed(a));
  if (claimed) return claimed;
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

/**
 * Does this listing occupy a PAID placement? Only a live featured/sponsor tier
 * does. `rel="sponsored"` describes payment for placement, and that is the
 * only thing it should describe here.
 *
 * Agency-client listings are deliberately NOT included (changed 2026-09-07).
 * They are free, ranked by the same published score as everyone else, and get
 * no placement benefit; what is true about them is a material connection, and
 * that is disclosed visibly on the card and the profile. Tagging an unpaid
 * listing "sponsored" would have mislabelled the relationship and stripped a
 * link the business earned on merit. See /editorial-policy.
 */
export const isSponsoredPlacement = (b: DirectoryBusiness) => hasActivePaidTier(b);

/** Material connection to disclose visibly — never expressed as a link rel. */
export const isAgencyClient = (b: DirectoryBusiness) => truthy(b.isClient);

let cache: { at: number; items: DirectoryBusiness[] } | null = null;
const CACHE_MS = 60_000;

/**
 * The directory universe: draft/published/suspended records. Registry rows
 * (`status = registered|lapsed`, seeded by the thousands from public license
 * rosters — see lib/registry.ts) are excluded AT THE QUERY so they can never
 * blow through the 1000-item cap, gain profile pages, or count toward the
 * 3-listing rule. Elevated filtered query on Wix; plain getAll + JS filter in
 * the harness.
 */
const DIRECTORY_STATUSES = ["draft", "published", "suspended"];

export async function fetchBusinesses(): Promise<DirectoryBusiness[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
  try {
    let items: DirectoryBusiness[] | null = null;
    try {
      const { auth } = await import("@wix/essentials");
      const data: any = await import("@wix/data");
      const q: any = auth.elevate(data.items.query);
      const res: any = await q("businesses")
        .hasSome("status", DIRECTORY_STATUSES)
        .limit(1000)
        .find();
      items = (res?.items ?? []).map((it: any) => ({ _id: it._id ?? it.id, ...(it.data ?? it) }));
    } catch {
      const result: any = await BaseCrudService.getAll("businesses", {}, { limit: 1000 });
      const raw: DirectoryBusiness[] = Array.isArray(result) ? result : (result?.items ?? []);
      items = raw.filter((b) => DIRECTORY_STATUSES.includes(b.status ?? ""));
    }
    // Only records with the directory schema count at all.
    const valid = (items ?? []).filter((b) => b.slug && b.status);
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
  stateSlug: string,
  townSlug: string,
  categorySlug: string,
  preview = false,
): Promise<ListingSet> {
  // Town slugs are unique per state — a business only matches towns in its
  // own state (nj "roxbury" never serves ny/delaware-county/roxbury).
  const all = await fetchBusinesses();
  return toListingSet(
    all.filter(
      (b) =>
        inScope(preview)(b) &&
        b.stateSlug === stateSlug &&
        servesTown(b, townSlug) &&
        categoriesOf(b).has(categorySlug),
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
        b.stateSlug === stateSlug &&
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
export async function qualifiedCategoriesForTown(
  stateSlug: string,
  townSlug: string,
  min = 3,
): Promise<Map<string, number>> {
  const all = await fetchBusinesses();
  const counts = new Map<string, number>();
  for (const b of all) {
    if (!isPublished(b) || b.stateSlug !== stateSlug || !servesTown(b, townSlug)) continue;
    for (const cat of categoriesOf(b)) counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return new Map([...counts].filter(([, n]) => n >= min));
}
