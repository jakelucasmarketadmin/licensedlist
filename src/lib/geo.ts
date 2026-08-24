import {
  STATE_SEED,
  COUNTY_SEED,
  TOWN_SEED,
  type StateSeed,
  type CountySeed,
  type TownSeed,
} from "@/data/geo.generated";

export type { StateSeed, CountySeed, TownSeed };

const bySort = <T extends { sortOrder?: number }>(a: T, b: T) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

export function getStates(): StateSeed[] {
  return [...STATE_SEED].sort(bySort);
}

export function getState(slug: string): StateSeed | undefined {
  return STATE_SEED.find((s) => s.slug === slug);
}

export function getCountiesByState(stateSlug: string): CountySeed[] {
  return COUNTY_SEED.filter((c) => c.stateSlug === stateSlug).sort(
    (a, b) => (b.population ?? 0) - (a.population ?? 0),
  );
}

export function getCounty(stateSlug: string, countySlug: string): CountySeed | undefined {
  return COUNTY_SEED.find((c) => c.stateSlug === stateSlug && c.slug === countySlug);
}

export function getTownsByCounty(stateSlug: string, countySlug: string): TownSeed[] {
  return TOWN_SEED.filter((t) => t.stateSlug === stateSlug && t.countySlug === countySlug).sort(
    (a, b) => (b.population ?? 0) - (a.population ?? 0),
  );
}

export function getTown(
  stateSlug: string,
  countySlug: string,
  townSlug: string,
): TownSeed | undefined {
  return TOWN_SEED.find(
    (t) => t.stateSlug === stateSlug && t.countySlug === countySlug && t.slug === townSlug,
  );
}

export function getNearbyTowns(town: TownSeed): TownSeed[] {
  // nearbySlugs resolve within the same state (slugs are unique per state).
  return town.nearbySlugs
    .map((slug) => TOWN_SEED.find((t) => t.slug === slug && t.stateSlug === town.stateSlug))
    .filter((t): t is TownSeed => Boolean(t));
}

function distance(a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number }): number {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  // Flat-earth approximation is fine at county scale.
  const dLat = a.lat - b.lat;
  const dLng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}

export function getNearbyCounties(county: CountySeed, limit = 4): CountySeed[] {
  return COUNTY_SEED.filter((c) => c.slug !== county.slug && c.stateSlug === county.stateSlug)
    .sort((a, b) => distance(a, county) - distance(b, county))
    .slice(0, limit);
}

export function getAllTowns(): TownSeed[] {
  return TOWN_SEED;
}

/** Resolve a town by slug (service areas cross counties). Slugs are unique per
 * state — pass stateSlug whenever known. */
export function getTownBySlug(slug: string, stateSlug?: string): TownSeed | undefined {
  return TOWN_SEED.find((t) => t.slug === slug && (!stateSlug || t.stateSlug === stateSlug));
}

/** Every hub path: /nj, /nj/bergen-county, /nj/bergen-county/hackensack … */
export function hubPaths(): string[] {
  return [
    ...STATE_SEED.map((s) => `/${s.slug}`),
    ...COUNTY_SEED.map((c) => `/${c.pathKey}`),
    ...TOWN_SEED.map((t) => `/${t.pathKey}`),
  ];
}

export interface HubMatch {
  kind: "state" | "county" | "town";
  state: StateSeed;
  county?: CountySeed;
  town?: TownSeed;
}

/** Resolve a pathname like /nj/bergen-county/hackensack to hub data, if valid. */
export function matchHubPath(pathname: string): HubMatch | undefined {
  const segments = pathname.replace(/^\/+/, "").split("/");
  if (segments.length < 1 || segments.length > 3) return undefined;
  const state = getState(segments[0]);
  if (!state) return undefined;
  if (segments.length === 1) return { kind: "state", state };
  const county = getCounty(state.slug, segments[1]);
  if (!county) return undefined;
  if (segments.length === 2) return { kind: "county", state, county };
  const town = getTown(state.slug, county.slug, segments[2]);
  if (!town) return undefined;
  return { kind: "town", state, county, town };
}
