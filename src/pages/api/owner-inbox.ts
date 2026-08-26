import type { APIRoute } from "astro";
import { elevatedData, json, clean } from "@/lib/server-data";

/**
 * Owner inbox: leads pipeline, review responses, Q&A answers.
 *
 * Auth model matches /api/owner-listing: signed-in Wix member + an approved
 * `claims` record. Every mutation re-checks that the target row belongs to
 * the caller's business.
 *
 * Review guardrails (docs/REVIEWS.md): owners can respond publicly and flag —
 * never edit, hide, or delete a review. AI reply drafts are suggestions the
 * owner edits and sends themselves; they are never auto-posted.
 */
async function currentMemberId(): Promise<string | null> {
  try {
    const { members } = await import("@wix/members");
    const res: any = await members.getCurrentMember();
    return res?.member?._id ?? res?._id ?? null;
  } catch {
    return null;
  }
}

async function ownedBusinessSlug(query: any, memberId: string): Promise<string | null> {
  const claimsRes: any = await query({ dataCollectionId: "claims" })
    .eq("memberId", memberId)
    .eq("status", "approved")
    .find();
  const claim = claimsRes?.items?.[0]?.data ?? claimsRes?.items?.[0];
  return claim?.businessSlug ?? null;
}

const rowsFor = async (query: any, collection: string, field: string, slug: string) => {
  const res: any = await query({ dataCollectionId: collection }).eq(field, slug).find();
  return (res?.items ?? []).map((it: any) => ({ _id: it._id ?? it.id, ...(it.data ?? it) }));
};

export const GET: APIRoute = async () => {
  const memberId = await currentMemberId();
  if (!memberId) return json({ ok: false, error: "sign in required" }, 401);
  try {
    const { query } = await elevatedData();
    const slug = await ownedBusinessSlug(query, memberId);
    if (!slug) return json({ ok: false, error: "no approved claim" }, 403);

    const [leads, reviews, questions] = await Promise.all([
      rowsFor(query, "leads", "businessSlugs", slug),
      rowsFor(query, "reviews", "businessSlug", slug),
      rowsFor(query, "questions", "businessSlug", slug),
    ]);
    return json({
      ok: true,
      businessSlug: slug,
      leads: leads.map((l: any) => ({
        _id: l._id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        message: l.message,
        urgency: l.urgency,
        status: l.status ?? "new",
        wonAt: l.wonAt ?? null,
        reviewInviteSentAt: l.reviewInviteSentAt ?? null,
        reviewSubmittedAt: l.reviewSubmittedAt ?? null,
        createdAt: l._createdDate ?? null,
      })),
      reviews: reviews.map((r: any) => ({
        _id: r._id,
        reviewerName: r.reviewerName,
        rating: r.rating,
        body: r.body,
        jobType: r.jobType,
        verifiedHire: r.verifiedHire === true || r.verifiedHire === "true",
        moderationStatus: r.moderationStatus,
        ownerResponse: r.ownerResponse ?? "",
        ownerFlag: r.ownerFlag ?? "",
        createdAt: r._createdDate ?? null,
      })),
      questions: questions.map((q: any) => ({
        _id: q._id,
        question: q.question,
        askerName: q.askerName,
        answer: q.answer ?? "",
        moderationStatus: q.moderationStatus,
        createdAt: q._createdDate ?? null,
      })),
    });
  } catch (err) {
    console.error("owner-inbox GET failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};

const LEAD_STATUSES = new Set(["new", "contacted", "won", "lost"]);

export const POST: APIRoute = async ({ request }) => {
  const memberId = await currentMemberId();
  if (!memberId) return json({ ok: false, error: "sign in required" }, 401);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  const action = String(body.action ?? "");
  const id = String(body.id ?? "");

  try {
    const { query, getItem, updateItem } = await elevatedData();
    const slug = await ownedBusinessSlug(query, memberId);
    if (!slug) return json({ ok: false, error: "no approved claim" }, 403);

    const loadOwned = async (collection: string, field: string) => {
      const item: any = await getItem(id, { dataCollectionId: collection });
      const data = item?.data ?? item;
      if (!data || data[field] !== slug) return null;
      return data;
    };

    if (action === "lead-status") {
      const status = String(body.status ?? "");
      if (!LEAD_STATUSES.has(status)) return json({ ok: false, error: "bad status" }, 400);
      const lead = await loadOwned("leads", "businessSlugs");
      if (!lead) return json({ ok: false, error: "not found" }, 404);
      const patch: any = { ...lead, status };
      // wonAt starts the 7-day review-invite clock; set once.
      if (status === "won" && !lead.wonAt) patch.wonAt = new Date().toISOString();
      await updateItem(id, { dataCollectionId: "leads", dataItem: { data: patch } });
      return json({ ok: true, wonAt: patch.wonAt ?? null });
    }

    if (action === "respond-review") {
      const response = clean(body.response, 2000);
      if (!response) return json({ ok: false, error: "empty response" }, 400);
      const review = await loadOwned("reviews", "businessSlug");
      if (!review) return json({ ok: false, error: "not found" }, 404);
      await updateItem(id, {
        dataCollectionId: "reviews",
        dataItem: {
          data: { ...review, ownerResponse: response, ownerRespondedAt: new Date().toISOString() },
        },
      });
      return json({ ok: true });
    }

    if (action === "flag-review") {
      const reason = clean(body.reason, 500);
      const review = await loadOwned("reviews", "businessSlug");
      if (!review) return json({ ok: false, error: "not found" }, 404);
      await updateItem(id, {
        dataCollectionId: "reviews",
        dataItem: {
          data: { ...review, ownerFlag: `${reason} (flagged ${new Date().toISOString()})` },
        },
      });
      return json({ ok: true });
    }

    if (action === "answer-question") {
      const answer = clean(body.answer, 2000);
      if (!answer) return json({ ok: false, error: "empty answer" }, 400);
      const q = await loadOwned("questions", "businessSlug");
      if (!q) return json({ ok: false, error: "not found" }, 404);
      // Stays in moderation until published from the dashboard (RUNBOOK §8).
      await updateItem(id, {
        dataCollectionId: "questions",
        dataItem: { data: { ...q, answer, answeredAt: new Date().toISOString() } },
      });
      return json({ ok: true });
    }

    if (action === "draft-reply") {
      const review = await loadOwned("reviews", "businessSlug");
      if (!review) return json({ ok: false, error: "not found" }, 404);
      const draft = await draftReply(review);
      return json({ ok: true, ...draft });
    }

    return json({ ok: false, error: "unknown action" }, 400);
  } catch (err) {
    console.error("owner-inbox POST failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};

/**
 * AI-drafted reply suggestion — labeled in the UI, edited by the owner,
 * never auto-posted. Uses the Anthropic API when ANTHROPIC_API_KEY is set;
 * otherwise a rating-aware template so the button still helps.
 */
async function draftReply(review: any): Promise<{ draft: string; source: "ai" | "template" }> {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  const rating = Number(review.rating) || 0;
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Draft a short, professional public reply (2-4 sentences) from a local business owner to this customer review. Thank them, address specifics, no discounts or incentives, no admissions of legal liability, no personal data. Rating: ${rating}/5. Review: "${String(review.body ?? "").slice(0, 1500)}"`,
            },
          ],
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const text = data?.content?.[0]?.text?.trim();
        if (text) return { draft: text, source: "ai" };
      }
    } catch { /* fall through to template */ }
  }
  const name = review.reviewerName ? `, ${String(review.reviewerName).split(" ")[0]}` : "";
  const draft =
    rating >= 4
      ? `Thank you${name} — we really appreciate you taking the time to share this. It was a pleasure working on your ${review.jobType || "project"}, and we're glad the result landed well. We're here whenever you need us again.`
      : `Thank you for the honest feedback${name}. This isn't the experience we aim for, and we'd like to make it right — please reach out to us directly so we can talk through what happened with your ${review.jobType || "project"}.`;
  return { draft, source: "template" };
}
