import type { APIRoute } from "astro";
import { elevatedData, json } from "@/lib/server-data";

/**
 * Validates a one-time review token from an invitation email.
 * GET ?token=… → { ok, businessSlug, businessName, reviewerName } — just
 * enough to prefill the form; no lead PII beyond the first name.
 */
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token") ?? "";
  if (!/^[a-f0-9-]{36}$/.test(token)) return json({ ok: false, error: "bad token" }, 400);
  try {
    const { query } = await elevatedData();
    const res: any = await query({ dataCollectionId: "leads" }).eq("reviewToken", token).find();
    const item = res?.items?.[0];
    const lead = item?.data ?? item;
    if (!lead) return json({ ok: false, error: "unknown token" }, 404);
    if (lead.reviewSubmittedAt) return json({ ok: false, error: "already used" }, 410);
    const bizRes: any = await query({ dataCollectionId: "businesses" })
      .eq("slug", lead.businessSlugs)
      .find();
    const biz = bizRes?.items?.[0]?.data ?? bizRes?.items?.[0];
    return json({
      ok: true,
      businessSlug: lead.businessSlugs ?? "",
      businessName: biz?.name ?? "",
      reviewerName: (lead.name ?? "").split(" ")[0],
    });
  } catch (err) {
    console.error("review-token failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
