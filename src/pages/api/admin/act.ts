import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";
import { items } from "@/platform/wix/data";
import { getDb } from "@/platform/db";

/**
 * Approve or reject something in the admin queue. The middleware only lets
 * admins reach /api/admin/*, so this route never sees anyone else.
 *
 *   claim  → status approved/rejected; an approved claim unlocks /owner for
 *            the account with the claimant's email (now or when they sign up)
 *   edit   → an owner's change to a reviewed field (phone, website) is applied
 *            to the listing, or dropped
 *   review → moderationStatus published/rejected
 */
export const POST: APIRoute = async ({ request }) => {
  const admin = (globalThis as any).__currentMember?.();
  const body: any = await request.json().catch(() => ({}));
  const approve = body.action === "approve";
  if (!["approve", "reject"].includes(body.action) || typeof body.id !== "string") return json({ ok: false, error: "bad request" }, 400);
  const stamp = { reviewedAt: new Date().toISOString(), reviewedBy: admin?.email ?? "" };

  if (body.kind === "claim") {
    const claim = await items.get("claims", body.id);
    if (!claim) return json({ ok: false, error: "not found" }, 404);
    const next: Record<string, any> = { ...claim, ...stamp, status: approve ? "approved" : "rejected" };
    if (approve && !next.memberId && next.claimantEmail) {
      const user = await getDb().prepare("SELECT id FROM users WHERE email = ?").bind(String(next.claimantEmail).trim().toLowerCase()).first<{ id: string }>();
      if (user) next.memberId = user.id;
    }
    await items.update("claims", next);
    return json({ ok: true });
  }

  if (body.kind === "edit") {
    const edit = await items.get("edits", body.id);
    if (!edit || edit.status !== "pending") return json({ ok: false, error: "not found" }, 404);
    if (approve) {
      const res = await items.query("businesses").eq("slug", edit.businessSlug).limit(1).find();
      const biz = res.items[0];
      if (!biz) return json({ ok: false, error: "listing not found" }, 404);
      const changes: Record<string, string> = {};
      for (const [field, change] of Object.entries(edit.changes || {})) changes[field] = (change as any).to;
      await items.update("businesses", { ...biz, ...changes });
    }
    await items.update("edits", { ...edit, ...stamp, status: approve ? "approved" : "rejected" });
    return json({ ok: true });
  }

  if (body.kind === "review") {
    const review = await items.get("reviews", body.id);
    if (!review) return json({ ok: false, error: "not found" }, 404);
    await items.update("reviews", { ...review, ...stamp, moderationStatus: approve ? "published" : "rejected" });
    return json({ ok: true });
  }

  return json({ ok: false, error: "unknown kind" }, 400);
};
