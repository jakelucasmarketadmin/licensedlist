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

/** Pick the best of a photo set: owner-preferred flag, then a caption that
 * reads like a downtown/main-street shot, then the first. */
function pickBest(photos: TownPhotoSeed[]): TownPhotoSeed | undefined {
  if (!photos.length) return undefined;
  return (
    photos.find((p) => p.preferred === "true") ??
    photos.find((p) => /downtown|main street|avenue/i.test(p.caption)) ??
    photos[0]
  );
}

/** CSS object-position from the photo's focal point (defaults to center). */
export function focalPosition(p: TownPhotoSeed): string {
  const x = p.focalX && !Number.isNaN(Number(p.focalX)) ? `${p.focalX}%` : "50%";
  const y = p.focalY && !Number.isNaN(Number(p.focalY)) ? `${p.focalY}%` : "50%";
  return `${x} ${y}`;
}

/** Best hero photo for a geo page: town first, then its county. */
export function heroPhotoFor(stateSlug: string, countySlug?: string, townSlug?: string): TownPhotoSeed | undefined {
  if (townSlug) {
    const t = pickBest(photosForTown(stateSlug, townSlug));
    if (t) return t;
  }
  if (countySlug) {
    const c = pickBest(photosForCounty(stateSlug, countySlug));
    if (c) return c;
  }
  return undefined;
}

/** Captions that never belong in a hero, whatever the flags say. */
const HERO_BLOCKLIST = /sign|parking|construction/i;

/**
 * Rotating hero pool for the home page: curated `heroEligible` photos first
 * (skyline/landscape shots — flag lives in TownPhotos and is dashboard-
 * curated), falling back to one-per-county when nothing is flagged. Photos
 * with sign/parking/construction captions are never eligible.
 */
export function homeHeroPhotos(limit = 5): TownPhotoSeed[] {
  const usable = TOWN_PHOTO_SEED.filter((p) => p.url && !HERO_BLOCKLIST.test(p.caption));
  const curated = usable.filter((p) => p.heroEligible === "true");
  if (curated.length) return curated.slice(0, Math.max(limit, curated.length));
  const seen = new Set<string>();
  const picks: TownPhotoSeed[] = [];
  for (const p of usable) {
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
