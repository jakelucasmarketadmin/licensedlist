import type { APIRoute } from "astro";
import { elevatedData, json, clean } from "@/lib/server-data";

/**
 * First-party analytics (Batch E) — PII-free by construction: day-bucketed
 * counters per (day, businessSlug, event), no IPs, no user ids, no UA
 * strings. Powers the owner dashboard without GA4.
 */
const EVENTS = new Set([
  "profile_view",
  "call_click",
  "website_click",
  "quote_started",
  "quote_submitted",
  "save",
  "share",
]);

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false }, 400);
  }
  const type = clean(body.type, 30);
  const businessSlug = clean(body.businessSlug, 120);
  if (!EVENTS.has(type) || !businessSlug) return json({ ok: false }, 400);

  const day = new Date().toISOString().slice(0, 10);
  try {
    const { query, insertItem, updateItem } = await elevatedData();
    const res: any = await query({ dataCollectionId: "metrics" })
      .eq("day", day)
      .eq("businessSlug", businessSlug)
      .eq("event", type)
      .find();
    const hit = res?.items?.[0];
    if (hit) {
      const data = hit.data ?? hit;
      await updateItem(hit._id ?? hit.id, {
        dataCollectionId: "metrics",
        dataItem: { data: { ...data, count: (Number(data.count) || 0) + 1 } },
      });
    } else {
      await insertItem({
        dataCollectionId: "metrics",
        dataItem: { data: { day, businessSlug, event: type, count: 1 } },
      });
    }
    return json({ ok: true });
  } catch (err) {
    console.error("track failed", err);
    return json({ ok: false }, 500);
  }
};
