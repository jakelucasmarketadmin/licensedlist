import { BaseCrudService } from "@/integrations";

/**
 * Deals & offers (C2) — collection `offers`. Owner-submitted (Jotform /
 * /owner), moderated; expired offers auto-hide at the query. Tier rule
 * (checked at moderation, RUNBOOK §10): Free tier max 1 active offer;
 * Verified/Featured unlimited.
 */

export interface Offer {
  _id: string;
  businessSlug?: string;
  businessName?: string;
  title?: string;
  details?: string;
  terms?: string;
  startsAt?: string | Date;
  expiresAt?: string | Date;
  code?: string;
  url?: string;
  image?: string;
  /** pending | published | rejected */
  status?: string;
  /** e.g. "owner-submission", "DEMO" */
  source?: string;
}

export const isDemoOffer = (o: Offer) => (o.source ?? "").includes("DEMO");

let cache: { at: number; items: Offer[] } | null = null;
const CACHE_MS = 5 * 60_000;

async function fetchAll(): Promise<Offer[]> {
  try {
    const { auth } = await import("@wix/essentials");
    const data: any = await import("@wix/data");
    const q: any = auth.elevate(data.items.query);
    const res: any = await q("offers").eq("status", "published").limit(1000).find();
    return (res?.items ?? []).map((it: any) => ({ _id: it._id ?? it.id, ...(it.data ?? it) }));
  } catch {
    try {
      const result: any = await BaseCrudService.getAll("offers", {}, { limit: 1000 });
      const items = Array.isArray(result) ? result : (result?.items ?? []);
      return items.filter((o: Offer) => o.status === "published");
    } catch {
      return [];
    }
  }
}

/** Published, started, unexpired offers — soonest-expiring first. */
export async function activeOffers(preview = false): Promise<Offer[]> {
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), items: await fetchAll() };
  const now = Date.now();
  return cache.items
    .filter((o) => {
      if (!preview && isDemoOffer(o)) return false;
      const started = !o.startsAt || new Date(o.startsAt).getTime() <= now;
      const unexpired = !o.expiresAt || new Date(o.expiresAt).getTime() >= now;
      return started && unexpired;
    })
    .sort((a, b) => new Date(a.expiresAt ?? "2999-01-01").getTime() - new Date(b.expiresAt ?? "2999-01-01").getTime());
}

export async function offersForBusiness(businessSlug: string, preview = false) {
  return (await activeOffers(preview)).filter((o) => o.businessSlug === businessSlug);
}

export function offerExpiryLabel(o: Offer): string {
  if (!o.expiresAt) return "";
  return `through ${new Date(o.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
