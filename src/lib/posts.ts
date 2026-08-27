import { BaseCrudService } from "@/integrations";

/**
 * Owner posts / "What's new" (Batch E) — collection `posts`. Owner-authored
 * updates that expire 30 days after posting (auto-hidden at the query).
 */
export interface OwnerPost {
  _id: string;
  businessSlug?: string;
  text?: string;
  expiresAt?: string | Date;
  _createdDate?: string | Date;
}

let cache: { at: number; items: OwnerPost[] } | null = null;
const CACHE_MS = 5 * 60_000;

async function fetchAll(): Promise<OwnerPost[]> {
  try {
    const { auth } = await import("@wix/essentials");
    const data: any = await import("@wix/data");
    const q: any = auth.elevate(data.items.query);
    const res: any = await q("posts").limit(1000).find();
    return (res?.items ?? []).map((it: any) => ({ _id: it._id ?? it.id, ...(it.data ?? it) }));
  } catch {
    try {
      const result: any = await BaseCrudService.getAll("posts", {}, { limit: 1000 });
      return Array.isArray(result) ? result : (result?.items ?? []);
    } catch {
      return [];
    }
  }
}

export async function postsForBusiness(businessSlug: string): Promise<OwnerPost[]> {
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), items: await fetchAll() };
  const now = Date.now();
  return cache.items
    .filter((p) => p.businessSlug === businessSlug && new Date(p.expiresAt ?? 0).getTime() > now)
    .sort((a, b) => new Date(b._createdDate ?? 0).getTime() - new Date(a._createdDate ?? 0).getTime())
    .slice(0, 3);
}
