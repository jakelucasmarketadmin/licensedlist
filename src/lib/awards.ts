import { BaseCrudService } from "@/integrations";

/**
 * LicensedList Best of {County} {Year} (C4) — collection `awards`. Winners are
 * COMPUTED (scripts/awards.ts), reviewed by the operator, then published —
 * never sold. Criteria (docs/AWARDS.md): verified license, ≥5 verified-hire
 * on-site reviews, ≥4.7 aspect average, response time < 24h, no unresolved
 * complaints. DEMO rows render only behind ?preview=demo.
 */

export interface Award {
  _id: string;
  businessSlug?: string;
  year?: number;
  stateSlug?: string;
  countySlug?: string;
  countyName?: string;
  categorySlug?: string;
  /** pending | published */
  status?: string;
  source?: string;
}

export const isDemoAward = (a: Award) => (a.source ?? "").includes("DEMO");

let cache: { at: number; items: Award[] } | null = null;
const CACHE_MS = 5 * 60_000;

async function fetchAll(): Promise<Award[]> {
  try {
    const { auth } = await import("@wix/essentials");
    const data: any = await import("@wix/data");
    const q: any = auth.elevate(data.items.query);
    const res: any = await q("awards").eq("status", "published").limit(1000).find();
    return (res?.items ?? []).map((it: any) => ({ _id: it._id ?? it.id, ...(it.data ?? it) }));
  } catch {
    try {
      const result: any = await BaseCrudService.getAll("awards", {}, { limit: 1000 });
      const items = Array.isArray(result) ? result : (result?.items ?? []);
      return items.filter((a: Award) => a.status === "published");
    } catch {
      return [];
    }
  }
}

export async function allAwards(preview = false): Promise<Award[]> {
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), items: await fetchAll() };
  return cache.items.filter((a) => preview || !isDemoAward(a));
}

export async function awardsForBusiness(businessSlug: string, preview = false): Promise<Award[]> {
  return (await allAwards(preview)).filter((a) => a.businessSlug === businessSlug);
}

export const awardLabel = (a: Award) => `Best of ${a.countyName ?? a.countySlug} ${a.year}`;
