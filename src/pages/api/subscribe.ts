import type { APIRoute } from "astro";
import { elevatedData, json, clean } from "@/lib/server-data";

/**
 * "LicensedList Weekly" newsletter capture (C5). Stores the address in the
 * `subscribers` collection (status=pending) and forwards to GHL
 * (GHL_NEWSLETTER_WEBHOOK), which runs the double-opt-in confirmation email;
 * status flips to confirmed via the GHL workflow (manual/dashboard for now —
 * RUNBOOK §10). Never subscribed without confirmation.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  if (body.company) return json({ ok: true }); // honeypot

  const email = clean(body.email, 120).toLowerCase();
  const source = clean(body.source, 80) || "site";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "bad email" }, 400);

  try {
    const { query, insertItem } = await elevatedData();
    const existing: any = await query({ dataCollectionId: "subscribers" }).eq("email", email).find();
    if (!existing?.items?.length) {
      await insertItem({
        dataCollectionId: "subscribers",
        dataItem: { data: { email, source, status: "pending" } },
      });
    }
    const webhook = import.meta.env.GHL_NEWSLETTER_WEBHOOK;
    if (webhook) {
      fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "newsletter-optin", email, source }),
      }).catch(() => {});
    }
    return json({ ok: true });
  } catch (err) {
    console.error("subscribe failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
