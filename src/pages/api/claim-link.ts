import type { APIRoute } from "astro";

/**
 * Links the signed-in member to a claim they just submitted, so a manual
 * dashboard approval (status → "approved") later unlocks /owner for them.
 * Sets memberId only when the claim has none yet — a claim can never be
 * re-linked to a different account. Never touches claim status.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad json" }), { status: 400 });
  }
  const claimId = typeof body?.claimId === "string" ? body.claimId : null;
  if (!claimId) return new Response(JSON.stringify({ ok: false, error: "claimId required" }), { status: 400 });

  let memberId: string | null = null;
  try {
    const { members } = await import("@wix/members");
    const res: any = await members.getCurrentMember();
    memberId = res?.member?._id ?? res?._id ?? null;
  } catch { /* not signed in */ }
  if (!memberId) return new Response(JSON.stringify({ ok: false, error: "not-signed-in" }), { status: 401 });

  try {
    const { auth } = await import("@wix/essentials");
    const data: any = await import("@wix/data");
    const getItem = auth.elevate(data.items.getDataItem);
    const updateItem = auth.elevate(data.items.updateDataItem);
    const current: any = await getItem(claimId, { dataCollectionId: "claims" });
    const claim = current?.data ?? current;
    if (!claim) return new Response(JSON.stringify({ ok: false, error: "not-found" }), { status: 404 });
    if (claim.memberId && claim.memberId !== memberId)
      return new Response(JSON.stringify({ ok: false, error: "already-linked" }), { status: 409 });
    await updateItem(claimId, {
      dataCollectionId: "claims",
      dataItem: { data: { ...claim, memberId } },
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("claim-link failed", err);
    return new Response(JSON.stringify({ ok: false, error: "server" }), { status: 500 });
  }
};
