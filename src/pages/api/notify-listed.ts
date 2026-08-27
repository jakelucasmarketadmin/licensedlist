import type { APIRoute } from "astro";
import { elevatedData, json } from "@/lib/server-data";
import { SITE_URL } from "@/lib/site";
import { jotformClaimRegistryUrl } from "@/lib/jotform";

/**
 * "You're listed" notices for unclaimed public-records listings (RUNBOOK
 * §14). Cron-secret gated; one notice per business ever (notifiedAt);
 * opt-outs excluded; {dryRun:true} lists recipients without sending.
 * Copy approved 2026-08-27 — send in batches ({limit}, default 5) a day apart
 * so a bad-address problem surfaces before it reaches everyone.
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.REVIEW_CRON_SECRET;
  if (!secret) return json({ ok: false, error: "REVIEW_CRON_SECRET not configured" }, 503);
  if (request.headers.get("x-cron-secret") !== secret) return json({ ok: false, error: "forbidden" }, 403);

  let body: any = {};
  try {
    body = await request.json();
  } catch { /* default */ }
  const dryRun = body.dryRun === true;
  // Batch cap: approved send policy is 5 per day (docs/outreach/listing-notice.md).
  const limit = Math.max(1, Math.min(50, Number(body.limit) || 5));
  const webhook = import.meta.env.GHL_NOTICE_WEBHOOK;
  if (!dryRun && !webhook) return json({ ok: false, error: "GHL_NOTICE_WEBHOOK not configured" }, 503);

  try {
    const { query, updateItem } = await elevatedData();
    const res: any = await query({ dataCollectionId: "businesses" })
      .eq("status", "published")
      .eq("listingSource", "public-records")
      .find();
    const results: { slug: string; email: string; sent: boolean; note?: string }[] = [];
    let picked = 0;
    for (const it of res?.items ?? []) {
      if (picked >= limit) break;
      const b = it.data ?? it;
      if (!b.email) { results.push({ slug: b.slug, email: "", sent: false, note: "no email on file" }); continue; }
      if (b.notifiedAt) continue;
      if (b.optOutAt) continue;
      if (b.claimed === true || b.claimed === "true") continue;
      if (dryRun) { picked++; results.push({ slug: b.slug, email: b.email, sent: false, note: "dry-run" }); continue; }
      picked++;
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "listing-notice",
          email: b.email,
          businessName: b.name,
          profileUrl: `${SITE_URL}/business/${b.slug}`,
          claimUrl: jotformClaimRegistryUrl(b.name ?? "", b.licenseNumber),
          removeUrl: `${SITE_URL}/remove-listing?biz=${b.slug}`,
        }),
      }).catch(() => null);
      const sent = Boolean(r?.ok);
      if (sent) {
        await updateItem(it._id ?? it.id, {
          dataCollectionId: "businesses",
          dataItem: { data: { ...b, notifiedAt: new Date().toISOString() } },
        });
      }
      results.push({ slug: b.slug, email: b.email, sent });
    }
    return json({ ok: true, limit, results });
  } catch (err) {
    console.error("notify-listed failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
