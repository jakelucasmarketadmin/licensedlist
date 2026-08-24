import type { APIRoute } from "astro";

/**
 * Owner self-service, enforced server-side.
 *
 * GET  → the signed-in member's approved business listing (whitelisted fields)
 * POST → update ONLY the whitelisted fields on that listing
 *
 * Authorization model: the caller must be a signed-in Wix member, and there
 * must be a `claims` record with `memberId == member._id` and
 * `status == "approved"` (approvals are manual in the dashboard). Reads of
 * claims/businesses run with elevated permissions server-side — never exposed
 * to the client. Owners can never touch license fields, ratings, or tier.
 */
const EDITABLE_FIELDS = [
  "description",
  "hoursJson",
  "photosJson",
  "services",
  "phone",
  "website",
] as const;

async function elevatedTools() {
  const { auth } = await import("@wix/essentials");
  const data: any = await import("@wix/data");
  return {
    query: auth.elevate(data.items.queryDataItems),
    getItem: auth.elevate(data.items.getDataItem),
    updateItem: auth.elevate(data.items.updateDataItem),
  };
}

async function currentMemberId(): Promise<string | null> {
  try {
    const { members } = await import("@wix/members");
    const res: any = await members.getCurrentMember();
    return res?.member?._id ?? res?._id ?? null;
  } catch {
    return null;
  }
}

async function approvedBusinessFor(memberId: string) {
  const { query } = await elevatedTools();
  const claimsRes: any = await query({ dataCollectionId: "claims" })
    .eq("memberId", memberId)
    .eq("status", "approved")
    .find();
  const claim = claimsRes?.items?.[0]?.data ?? claimsRes?.items?.[0];
  if (!claim?.businessSlug) return null;
  const bizRes: any = await query({ dataCollectionId: "businesses" })
    .eq("slug", claim.businessSlug)
    .find();
  const item = bizRes?.items?.[0];
  return item ? { raw: item, data: item.data ?? item } : null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const GET: APIRoute = async () => {
  const memberId = await currentMemberId();
  if (!memberId) return json({ ok: false, error: "not-signed-in" }, 401);
  try {
    const found = await approvedBusinessFor(memberId);
    if (!found) return json({ ok: true, listing: null });
    const d = found.data;
    return json({
      ok: true,
      listing: {
        slug: d.slug,
        name: d.name,
        status: d.status,
        tier: d.tier,
        licenseStatus: d.licenseStatus,
        description: d.description ?? "",
        hoursJson: d.hoursJson ?? "",
        photosJson: d.photosJson ?? "",
        services: d.services ?? "",
        phone: d.phone ?? "",
        website: d.website ?? "",
        city: d.city,
        state: d.state,
      },
    });
  } catch (err: any) {
    console.error("owner-listing GET failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const memberId = await currentMemberId();
  if (!memberId) return json({ ok: false, error: "not-signed-in" }, 401);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  // Whitelist enforcement: anything outside EDITABLE_FIELDS is dropped.
  const updates: Record<string, string> = {};
  for (const field of EDITABLE_FIELDS) {
    if (typeof body?.[field] === "string") updates[field] = body[field].slice(0, 4000);
  }
  if (updates.hoursJson) {
    try { JSON.parse(updates.hoursJson); } catch { return json({ ok: false, error: "hoursJson must be valid JSON" }, 400); }
  }
  if (Object.keys(updates).length === 0) return json({ ok: false, error: "no editable fields" }, 400);
  try {
    const found = await approvedBusinessFor(memberId);
    if (!found) return json({ ok: false, error: "no-approved-claim" }, 403);
    const { updateItem } = await elevatedTools();
    const itemId = found.raw._id ?? found.data._id;
    await updateItem(itemId, {
      dataCollectionId: "businesses",
      dataItem: { data: { ...found.data, ...updates } },
    });
    return json({ ok: true });
  } catch (err: any) {
    console.error("owner-listing POST failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
