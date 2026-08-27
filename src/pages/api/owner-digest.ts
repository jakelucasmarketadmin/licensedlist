import type { APIRoute } from "astro";
import { elevatedData, json } from "@/lib/server-data";
import { fetchBusinesses, isPublished } from "@/lib/businesses";
import { SITE_URL } from "@/lib/site";

/**
 * Weekly owner digest (Batch E): compiles each published business's last-7-day
 * first-party stats + pending items and posts one payload per business to
 * GHL_OWNER_DIGEST_WEBHOOK (GHL matches by owner email and sends the email).
 * Schedule: weekly ping with the same x-cron-secret rail as review-invites.
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.REVIEW_CRON_SECRET;
  if (!secret) return json({ ok: false, error: "REVIEW_CRON_SECRET not configured" }, 503);
  if (request.headers.get("x-cron-secret") !== secret) return json({ ok: false, error: "forbidden" }, 403);
  const webhook = import.meta.env.GHL_OWNER_DIGEST_WEBHOOK;
  if (!webhook) return json({ ok: false, error: "GHL_OWNER_DIGEST_WEBHOOK not configured" }, 503);

  try {
    const { query } = await elevatedData();
    const cutoff = new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10);
    const mRes: any = await query({ dataCollectionId: "metrics" }).ge("day", cutoff).limit(1000).find();
    const rows: any[] = (mRes?.items ?? []).map((it: any) => it.data ?? it);
    const rRes: any = await query({ dataCollectionId: "reviews" }).find();
    const reviews: any[] = (rRes?.items ?? []).map((it: any) => it.data ?? it);

    const published = (await fetchBusinesses()).filter(isPublished);
    const sent: string[] = [];
    for (const b of published) {
      if (!b.email) continue;
      const week: Record<string, number> = {};
      for (const r of rows) {
        if (r.businessSlug !== b.slug) continue;
        week[r.event] = (week[r.event] ?? 0) + (Number(r.count) || 0);
      }
      const pendingReviews = reviews.filter(
        (r) => r.businessSlug === b.slug && r.moderationStatus === "published" && !r.ownerResponse,
      ).length;
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "owner-weekly-digest",
          email: b.email,
          businessName: b.name,
          profileUrl: `${SITE_URL}/business/${b.slug}`,
          ownerUrl: `${SITE_URL}/owner`,
          week,
          pendingReviews,
        }),
      }).catch(() => null);
      if (res?.ok) sent.push(b.slug ?? "");
    }
    return json({ ok: true, sent });
  } catch (err) {
    console.error("owner-digest failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
