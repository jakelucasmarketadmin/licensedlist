import type { APIRoute } from "astro";
import { elevatedData, json, clean } from "@/lib/server-data";

/**
 * Consumer Q&A intake — stored `pending`; published only after the owner
 * answers and it clears moderation. Asker email is kept for moderation
 * contact and never rendered.
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
  const question = clean(body.question, 500);
  const askerName = clean(body.askerName, 80);
  const askerEmail = clean(body.askerEmail, 120);
  if (!businessSlug || !question || !askerName || !askerEmail)
    return json({ ok: false, error: "missing fields" }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(askerEmail))
    return json({ ok: false, error: "bad email" }, 400);

  try {
    const { query, insertItem } = await elevatedData();
    const bizRes: any = await query({ dataCollectionId: "businesses" })
      .eq("slug", businessSlug)
      .find();
    if (!bizRes?.items?.length) return json({ ok: false, error: "unknown business" }, 404);
    await insertItem({
      dataCollectionId: "questions",
      dataItem: {
        data: { businessSlug, question, askerName, askerEmail, moderationStatus: "pending" },
      },
    });
    return json({ ok: true });
  } catch (err) {
    console.error("submit-question failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
