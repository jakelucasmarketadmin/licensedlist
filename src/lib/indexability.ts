/**
 * Which hub pages deserve to exist in the index (Gate B §3.1).
 *
 * The test, applied per URL: *could a user accomplish something here that they
 * couldn't on the parent page?* A town hub with no listings, no live category
 * page and no local data is a doorway page in Google's own words ("multiple
 * pages targeting specific regions/cities that funnel users to one
 * destination") — and thin pages suppress crawl demand for the good ones.
 *
 * Non-qualifying hubs still render (a visitor who lands on one gets a useful
 * page) but carry `noindex, follow` and stay out of the sitemap until they
 * earn their place. This is deliberately reversible: add a permit office or a
 * third listing and the page qualifies on the next build.
 */
import { getAllTowns, getTownsByCounty, type TownSeed } from "@/lib/geo";
import { getCategories } from "@/lib/taxonomy";
import { getGuide } from "@/lib/guides";
import { permitOfficeFor, townHousingFor } from "@/lib/moneypage";
import {
  type DirectoryBusiness,
  categoriesOf,
  isPublished,
  servesTown,
} from "@/lib/businesses";

export interface HubIndexability {
  /** Town hub path keys ("nj/bergen-county/westwood") that may be indexed. */
  towns: Set<string>;
  /** Category slugs that may be indexed. */
  categories: Set<string>;
  /** Geo×category paths ("/nj/bergen-county/westwood/plumbers") with >=3. */
  money: Set<string>;
  /** Diagnostics for the launch report. */
  stats: {
    townsTotal: number; townsIndexable: number;
    categoriesTotal: number; categoriesIndexable: number;
    moneyPages: number;
  };
}

const MIN_LISTINGS = 3;

/**
 * A town hub earns indexing when it has at least one of:
 *  - a live geo×category page beneath it (>=3 listings),
 *  - a business based in the town,
 *  - genuine local data: BOTH the Census housing profile AND a verified
 *    municipal permit office. Housing alone is a paragraph, not a page.
 */
export function computeIndexability(businesses: DirectoryBusiness[]): HubIndexability {
  const published = businesses.filter(isPublished);
  const towns = new Set<string>();
  const money = new Set<string>();

  // Count listings per town×category once, then derive both sets from it.
  const townCat = new Map<string, number>();
  const countyCat = new Map<string, number>();
  for (const b of published) {
    const cats = categoriesOf(b);
    for (const t of getAllTowns()) {
      if (b.stateSlug !== t.stateSlug || !servesTown(b, t.slug)) continue;
      for (const c of cats) townCat.set(`${t.pathKey}|${c}`, (townCat.get(`${t.pathKey}|${c}`) ?? 0) + 1);
    }
  }
  for (const [key, n] of townCat) {
    if (n < MIN_LISTINGS) continue;
    const [pathKey, cat] = key.split("|");
    money.add(`/${pathKey}/${cat}`);
    towns.add(pathKey);
  }

  // County×category uses the route's own membership rule (home county OR
  // serves a town in the county). Each county is visited exactly once — an
  // earlier version looped counties inside the town loop, which multiplied
  // every count by the number of towns and qualified pages that then 404'd.
  const seenCounties = new Set<string>();
  for (const t of getAllTowns()) {
    const countyKey = `${t.stateSlug}/${t.countySlug}`;
    if (seenCounties.has(countyKey)) continue;
    seenCounties.add(countyKey);
    const townSlugs = new Set(getTownsByCounty(t.stateSlug, t.countySlug).map((x) => x.slug));
    for (const b of published) {
      if (b.stateSlug !== t.stateSlug) continue;
      const inCounty = b.countySlug === t.countySlug || [...townSlugs].some((s) => servesTown(b, s));
      if (!inCounty) continue;
      for (const c of categoriesOf(b)) {
        const k = `${countyKey}|${c}`;
        countyCat.set(k, (countyCat.get(k) ?? 0) + 1);
      }
    }
  }
  for (const [key, n] of countyCat) {
    if (n < MIN_LISTINGS) continue;
    const [pathKey, cat] = key.split("|");
    money.add(`/${pathKey}/${cat}`);
  }

  // A town that hosts a business, or that we hold real local data for.
  for (const b of published) if (b.pathKey) towns.add(b.pathKey);
  for (const t of getAllTowns()) {
    const hasHousing = Boolean(townHousingFor(t.slug, t.stateSlug));
    const hasPermits = Boolean(permitOfficeFor(t.slug, t.stateSlug, ""));
    if (hasHousing && hasPermits) towns.add(t.pathKey);
  }

  // Category hubs: at least one published business, or a real guide.
  const categories = new Set<string>();
  for (const c of getCategories()) {
    const hasBusiness = published.some((b) => categoriesOf(b).has(c.slug));
    const hasGuide = Boolean(
      getGuide("category", c.slug, "hiring-") || getGuide("category", c.slug, "cost-context-"),
    );
    if (hasBusiness || hasGuide) categories.add(c.slug);
  }

  return {
    towns,
    categories,
    money,
    stats: {
      townsTotal: getAllTowns().length,
      townsIndexable: towns.size,
      categoriesTotal: getCategories().length,
      categoriesIndexable: categories.size,
      moneyPages: money.size,
    },
  };
}

/** Convenience for the route: is this town hub indexable? */
export const townIndexable = (idx: HubIndexability, town: TownSeed) => idx.towns.has(town.pathKey);
