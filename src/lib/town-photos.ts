/**
 * Curated place photography (Wikimedia Commons, credited) — the second rung of
 * the photo fallback ladder: business photo → town photo → category tile.
 * Data lives in data/geo/town-photos.csv → town-photos.generated.ts.
 */
import { TOWN_PHOTO_SEED, type TownPhotoSeed } from "@/data/town-photos.generated";

export type { TownPhotoSeed };

export function photosForTown(stateSlug: string, townSlug: string): TownPhotoSeed[] {
  return TOWN_PHOTO_SEED.filter(
    (p) => p.scope === "town" && p.stateSlug === stateSlug && p.townSlug === townSlug && p.url,
  );
}

export function photosForCounty(stateSlug: string, countySlug: string): TownPhotoSeed[] {
  return TOWN_PHOTO_SEED.filter(
    (p) => p.scope === "county" && p.stateSlug === stateSlug && p.countySlug === countySlug && p.url,
  );
}

/** Best hero photo for a geo page: town first, then its county. */
export function heroPhotoFor(stateSlug: string, countySlug?: string, townSlug?: string): TownPhotoSeed | undefined {
  if (townSlug) {
    const t = photosForTown(stateSlug, townSlug);
    if (t.length) return t[0];
  }
  if (countySlug) {
    const c = photosForCounty(stateSlug, countySlug);
    if (c.length) return c[0];
  }
  return undefined;
}

/** Rotating hero pool for the home page (one per county, deterministic order). */
export function homeHeroPhotos(limit = 5): TownPhotoSeed[] {
  const seen = new Set<string>();
  const picks: TownPhotoSeed[] = [];
  for (const p of TOWN_PHOTO_SEED) {
    if (!p.url) continue;
    const key = `${p.stateSlug}|${p.countySlug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push(p);
    if (picks.length >= limit) break;
  }
  return picks;
}

export function allCredits(): TownPhotoSeed[] {
  return TOWN_PHOTO_SEED.filter((p) => p.url);
}
