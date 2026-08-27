import type { APIRoute } from "astro";
import { elevatedData, json, clean } from "@/lib/server-data";

/**
 * Unclaimed-listing removal requests (opt-out policy on /how-we-verify):
 * writes a `claims` row with method="removal". Ops honors it within 2
 * business days and stamps optOutAt on the business so no re-import can
 * resurrect it (RUNBOOK §14).
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  if (body.company) return json({ ok: true }); // honeypot

  const businessSlug = clean(body.businessSlug, 120);
  const name = clean(body.name, 100);
  const role = clean(body.role, 80);
  const email = clean(body.email, 120);
  const reason = clean(body.reason, 500);
  if (!businessSlug || !name || !email) return json({ ok: false, error: "missing fields" }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "bad email" }, 400);

  try {
    const { query, insertItem } = await elevatedData();
    const biz: any = await query({ dataCollectionId: "businesses" }).eq("slug", businessSlug).find();
    if (!biz?.items?.length) return json({ ok: false, error: "unknown business" }, 404);
    await insertItem({
      dataCollectionId: "claims",
      dataItem: {
        data: { businessSlug, method: "removal", name, role, email, reason, status: "new" },
      },
    });
    // GHL heads-up so it hits the ops inbox within the 2-day SLA.
    const webhook = import.meta.env.GHL_CLAIM_WEBHOOK;
    if (webhook) {
      fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "removal-request", businessSlug, name, role, email, reason }),
      }).catch(() => {});
    }
    return json({ ok: true });
  } catch (err) {
    console.error("remove-listing failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
