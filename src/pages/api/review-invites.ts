import type { APIRoute } from "astro";
import { elevatedData, json } from "@/lib/server-data";
import { SITE_URL, SITE_NAME } from "@/lib/site";

/**
 * Review-invitation runner (docs/REVIEWS.md): 7 days after a lead is marked
 * `won`, the consumer gets ONE review link with a one-time token — sent to
 * EVERY won lead, never filtered by expected sentiment (FTC). One reminder
 * max, 7 days later.
 *
 * Email delivery goes through GHL (GHL_REVIEW_WEBHOOK), the same rail the
 * lead/claim notifications use; the webhook payload carries everything the
 * email template needs. Schedule: POST here daily (GHL workflow or any cron
 * pinger) with header `x-cron-secret: $REVIEW_CRON_SECRET`. Without the
 * secret configured the endpoint stays disabled.
 */
const DAY = 24 * 60 * 60 * 1000;
const INVITE_AFTER_MS = 7 * DAY;
const REMINDER_AFTER_MS = 7 * DAY;

export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.REVIEW_CRON_SECRET;
  if (!secret) return json({ ok: false, error: "REVIEW_CRON_SECRET not configured" }, 503);
  if (request.headers.get("x-cron-secret") !== secret)
    return json({ ok: false, error: "forbidden" }, 403);

  const webhook = import.meta.env.GHL_REVIEW_WEBHOOK;
  const now = Date.now();
  const results: { leadId: string; kind: string; delivered: boolean }[] = [];

  try {
    const { query, updateItem } = await elevatedData();
    const res: any = await query({ dataCollectionId: "leads" }).eq("status", "won").find();
    const items: any[] = res?.items ?? [];

    for (const item of items) {
      const lead = item.data ?? item;
      const id = item._id ?? item.id;
      if (!lead.email || lead.reviewSubmittedAt) continue;
      const wonAt = lead.wonAt ? new Date(lead.wonAt).getTime() : null;
      if (!wonAt) continue;

      let kind: "invite" | "reminder" | null = null;
      if (!lead.reviewInviteSentAt && now - wonAt >= INVITE_AFTER_MS) kind = "invite";
      else if (
        lead.reviewInviteSentAt &&
        !lead.reviewReminderSentAt &&
        now - new Date(lead.reviewInviteSentAt).getTime() >= REMINDER_AFTER_MS
      )
        kind = "reminder";
      if (!kind) continue;

      const token = lead.reviewToken || crypto.randomUUID();
      const reviewUrl = `${SITE_URL}/write-review?token=${token}`;

      let delivered = false;
      if (webhook) {
        try {
          const r = await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: `review-${kind}`,
              email: lead.email,
              name: lead.name ?? "",
              businessSlug: lead.businessSlugs ?? "",
              reviewUrl,
              siteName: SITE_NAME,
            }),
          });
          delivered = r.ok;
        } catch { /* logged below via results */ }
      }

      // Only mark sent when the email rail accepted it — otherwise retry on
      // the next run.
      if (delivered) {
        const stamp = new Date().toISOString();
        await updateItem(id, {
          dataCollectionId: "leads",
          dataItem: {
            data: {
              ...lead,
              reviewToken: token,
              ...(kind === "invite"
                ? { reviewInviteSentAt: stamp }
                : { reviewReminderSentAt: stamp }),
            },
          },
        });
      }
      results.push({ leadId: id, kind, delivered });
    }
    return json({ ok: true, processed: results, webhookConfigured: Boolean(webhook) });
  } catch (err) {
    console.error("review-invites failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
