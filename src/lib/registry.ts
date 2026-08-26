import { BaseCrudService } from "@/integrations";
import type { DirectoryBusiness } from "@/lib/businesses";

/**
 * Registry layer — "registered, unclaimed" businesses seeded from public
 * license rosters (docs/REGISTRY.md). Registered rows live in the
 * `businesses` collection with `status = registered` but are a separate
 * universe from the verified directory:
 *
 *  - no profile page (the catch-all 404s them — they're excluded from
 *    fetchBusinesses), no sitemap entry, no new indexable URLs;
 *  - they never count toward the 3-listing publishing rule;
 *  - they render only as the compact "Also licensed in {County}" table on
 *    already-existing list pages (data-nosnippet) and as counters.
 *
 * Queries here are filtered server-side (the registry can hold thousands of
 * rows — never pull it through the 1000-cap fetchBusinesses path). Elevated
 * first, BaseCrudService fallback for the harness.
 */

export interface RegisteredBusiness {
  _id: string;
  name?: string;
  slug?: string;
  status?: string;
  stateSlug?: string;
  countySlug?: string;
  townSlug?: string;
  city?: string;
  zip?: string;
  phone?: string;
  primaryCategorySlug?: string;
  licenseNumber?: string;
  licenseSource?: string;
  licenseExpiresAt?: string;
  foundingMember?: boolean | string;
  foundingCounty?: string;
}

const FIELDS = [
  "name", "slug", "status", "stateSlug", "countySlug", "townSlug", "city", "zip",
  "primaryCategorySlug", "licenseNumber", "licenseSource", "licenseExpiresAt",
] as const;

async function elevatedQuery(): Promise<((collection: string) => any) | null> {
  try {
    const { auth } = await import("@wix/essentials");
    const data: any = await import("@wix/data");
    return auth.elevate(data.items.query) as any;
  } catch {
    return null;
  }
}

/** Harness fallback: whole-collection getAll + JS filtering (small fixtures). */
async function fallbackAll(): Promise<RegisteredBusiness[]> {
  try {
    const result: any = await BaseCrudService.getAll("businesses", {}, { limit: 1000 });
    const items: any[] = Array.isArray(result) ? result : (result?.items ?? []);
    return items.filter((b) => b.status === "registered");
  } catch {
    return [];
  }
}

const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_MS = 5 * 60_000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export interface RegistryScope {
  stateSlug: string;
  countySlug?: string;
  categorySlug?: string;
}

function applyScope(b: any, scope: RegistryScope) {
  let out = b.eq("status", "registered").eq("stateSlug", scope.stateSlug);
  if (scope.countySlug) out = out.eq("countySlug", scope.countySlug);
  if (scope.categorySlug) out = out.eq("primaryCategorySlug", scope.categorySlug);
  return out;
}

/** Count of registered rows in scope (0 on any failure — modules hide). */
export async function countRegistered(scope: RegistryScope): Promise<number> {
  const key = `count|${scope.stateSlug}|${scope.countySlug ?? ""}|${scope.categorySlug ?? ""}`;
  return cached(key, async () => {
    const q = await elevatedQuery();
    if (q) {
      try {
        const b = applyScope(q("businesses"), scope);
        if (typeof b.count === "function") return await b.count();
        const res = await b.limit(1000).find();
        return res?.items?.length ?? 0;
      } catch {
        return 0;
      }
    }
    const all = await fallbackAll();
    return all.filter(
      (r) =>
        r.stateSlug === scope.stateSlug &&
        (!scope.countySlug || r.countySlug === scope.countySlug) &&
        (!scope.categorySlug || r.primaryCategorySlug === scope.categorySlug),
    ).length;
  });
}

/** First `limit` registered rows in scope, name order. */
export async function listRegistered(
  scope: RegistryScope,
  limit = 100,
): Promise<RegisteredBusiness[]> {
  const key = `list|${scope.stateSlug}|${scope.countySlug ?? ""}|${scope.categorySlug ?? ""}|${limit}`;
  return cached(key, async () => {
    const q = await elevatedQuery();
    if (q) {
      try {
        const res = await applyScope(q("businesses"), scope).ascending("name").limit(limit).find();
        return (res?.items ?? []).map((it: any) => {
          const src = it.data ?? it;
          const row: any = { _id: it._id ?? it.id };
          for (const f of FIELDS) row[f] = src[f];
          return row as RegisteredBusiness;
        });
      } catch {
        return [];
      }
    }
    const all = await fallbackAll();
    return all
      .filter(
        (r) =>
          r.stateSlug === scope.stateSlug &&
          (!scope.countySlug || r.countySlug === scope.countySlug) &&
          (!scope.categorySlug || r.primaryCategorySlug === scope.categorySlug),
      )
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      .slice(0, limit);
  });
}

/** Totals for the home meta line and county hub stat lines. */
export async function registryTotals(): Promise<{ registered: number; byCounty: Map<string, number> }> {
  return cached("totals", async () => {
    const q = await elevatedQuery();
    const byCounty = new Map<string, number>();
    if (q) {
      try {
        let registered = 0;
        // Page through in 1000-row chunks reading only scope fields; counts
        // per state|county pair.
        let skip = 0;
        for (;;) {
          const res = await q("businesses")
            .eq("status", "registered")
            .limit(1000)
            .skip(skip)
            .find();
          const items: any[] = res?.items ?? [];
          for (const it of items) {
            const src = it.data ?? it;
            registered++;
            const key = `${src.stateSlug}|${src.countySlug}`;
            byCounty.set(key, (byCounty.get(key) ?? 0) + 1);
          }
          if (items.length < 1000) break;
          skip += 1000;
          if (skip > 20000) break; // hard stop
        }
        return { registered, byCounty };
      } catch {
        return { registered: 0, byCounty };
      }
    }
    const all = await fallbackAll();
    for (const r of all) {
      const key = `${r.stateSlug}|${r.countySlug}`;
      byCounty.set(key, (byCounty.get(key) ?? 0) + 1);
    }
    return { registered: all.length, byCounty };
  });
}

/** Founding-member counters: approved founding members per county. */
export async function foundingCounts(): Promise<Map<string, number>> {
  return cached("founding", async () => {
    const counts = new Map<string, number>();
    const q = await elevatedQuery();
    if (q) {
      try {
        const res = await q("businesses").eq("foundingMember", true).limit(1000).find();
        for (const it of res?.items ?? []) {
          const src = it.data ?? it;
          const key = src.foundingCounty || `${src.stateSlug}|${src.countySlug}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      } catch { /* empty */ }
    }
    return counts;
  });
}

export const FOUNDING_CAP_PER_COUNTY = 200;
