import type { APIRoute } from "astro";
import { elevatedData, json, clean } from "@/lib/server-data";
import { ASPECT_KEYS } from "@/lib/reviews";

/**
 * Creates a review as `pending` for moderation (docs/REVIEWS.md).
 *
 * `verifiedHire` is decided HERE, never by the client: true only when a valid
 * unused one-time token from a won lead accompanies the submission. Public
 * submissions (no token) are stored as source=public / verifiedHire=false and
 * render with the "Unverified" label. Moderation checks identity and job
 * linkage only — sentiment is never a factor.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  if (body.company) return json({ ok: true }); // honeypot: pretend success

  const businessSlug = clean(body.businessSlug, 120);
  const reviewerName = clean(body.reviewerName, 80);
  const reviewerEmail = clean(body.reviewerEmail, 120);
  const reviewBody = clean(body.body, 4000);
  const jobType = clean(body.jobType, 80);
  const townName = clean(body.townName, 80);
  const rating = Number(body.rating);
  const token = clean(body.token, 40);

  if (!businessSlug || !reviewerName || !reviewerEmail || !reviewBody)
    return json({ ok: false, error: "missing fields" }, 400);
  if (!(rating >= 1 && rating <= 5)) return json({ ok: false, error: "bad rating" }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reviewerEmail))
    return json({ ok: false, error: "bad email" }, 400);

  const aspects: Record<string, number> = {};
  for (const k of ASPECT_KEYS) {
    const v = Number(body.aspects?.[k]);
    if (v >= 1 && v <= 5) aspects[k] = v;
  }

  try {
    const { query, updateItem, insertItem } = await elevatedData();

    const bizRes: any = await query({ dataCollectionId: "businesses" })
      .eq("slug", businessSlug)
      .find();
    if (!bizRes?.items?.length) return json({ ok: false, error: "unknown business" }, 404);

    // Token → verified hire (server-side decision).
    let verifiedHire = false;
    let leadId = "";
    if (token) {
      const leadRes: any = await query({ dataCollectionId: "leads" })
        .eq("reviewToken", token)
        .find();
      const item = leadRes?.items?.[0];
      const lead = item?.data ?? item;
      if (!lead || lead.reviewSubmittedAt || lead.businessSlugs !== businessSlug)
        return json({ ok: false, error: "invalid token" }, 400);
      verifiedHire = true;
      leadId = item._id ?? item.id ?? "";
      await updateItem(leadId, {
        dataCollectionId: "leads",
        dataItem: { data: { ...lead, reviewSubmittedAt: new Date().toISOString() } },
      });
    }

    const created: any = await insertItem({
      dataCollectionId: "reviews",
      dataItem: {
        data: {
          businessSlug,
          reviewerName,
          reviewerEmail,
          rating,
          body: reviewBody,
          jobType,
          townName,
          aspectsJson: Object.keys(aspects).length ? JSON.stringify(aspects) : "",
          photosJson: "",
          verifiedHire,
          source: verifiedHire ? "licensedlist" : "public",
          moderationStatus: "pending",
          leadId,
        },
      },
    });
    return json({ ok: true, id: created?.dataItem?._id ?? created?._id ?? null, verifiedHire });
  } catch (err) {
    console.error("submit-review failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
