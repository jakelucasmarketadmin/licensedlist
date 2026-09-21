/**
 * Per-hub counts, used for meta descriptions and for the hub copy itself.
 *
 * These exist so a page can state a fact about itself that is true at render
 * time — "9 listings, 7 license-verified" — instead of a sentence that could
 * be true of any town (Phase 4 §0.3).
 */
import {
  type DirectoryBusiness,
  categoriesOf,
  isPublished,
  servesTown,
} from "@/lib/businesses";
import { getTownsByCounty, getCountiesByState, getAllTowns } from "@/lib/geo";

export interface HubStats {
  listings: number;
  verified: number;
  towns: number;
  counties: number;
  categories: number;
  registry: number;
}

const verifiedOf = (rows: DirectoryBusiness[]) =>
  rows.filter((b) => b.licenseStatus === "verified").length;

export function townStatsFor(all: DirectoryBusiness[], stateSlug: string, townSlug: string): HubStats {
  const rows = all.filter(isPublished).filter((b) => b.stateSlug === stateSlug && servesTown(b, townSlug));
  const cats = new Set<string>();
  for (const b of rows) for (const c of categoriesOf(b)) cats.add(c);
  return {
    listings: rows.length,
    verified: verifiedOf(rows),
    towns: 1,
    counties: 1,
    categories: cats.size,
    registry: 0,
  };
}

export function countyStatsFor(all: DirectoryBusiness[], stateSlug: string, countySlug: string): HubStats {
  const townSlugs = getTownsByCounty(stateSlug, countySlug).map((t) => t.slug);
  const rows = all
    .filter(isPublished)
    .filter((b) => b.stateSlug === stateSlug && (b.countySlug === countySlug || townSlugs.some((t) => servesTown(b, t))));
  const cats = new Set<string>();
  for (const b of rows) for (const c of categoriesOf(b)) cats.add(c);
  return {
    listings: rows.length,
    verified: verifiedOf(rows),
    towns: townSlugs.length,
    counties: 1,
    categories: cats.size,
    registry: 0,
  };
}

export function stateStatsFor(all: DirectoryBusiness[], stateSlug: string, registry = 0): HubStats {
  const rows = all.filter(isPublished).filter((b) => b.stateSlug === stateSlug);
  const cats = new Set<string>();
  for (const b of rows) for (const c of categoriesOf(b)) cats.add(c);
  return {
    listings: rows.length,
    verified: verifiedOf(rows),
    towns: getAllTowns().filter((t) => t.stateSlug === stateSlug).length,
    counties: getCountiesByState(stateSlug).length,
    categories: cats.size,
    registry,
  };
}
