import type { APIRoute } from "astro";

/**
 * Forwards a just-created lead/claim to GoHighLevel.
 *
 * Webhook URLs live in SERVER env (GHL_LEAD_WEBHOOK / GHL_CLAIM_WEBHOOK) so
 * they never reach the client. Retries 3× with backoff; the outcome is
 * appended to the record's `webhookLog` field via an elevated update (the
 * lead/claim collections are collect-content, so visitors can't update them —
 * elevation runs server-side only). If no URL is configured, log and continue.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad json" }), { status: 400 });
  }
  const { type, itemId, payload } = body ?? {};
  if ((type !== "lead" && type !== "claim") || typeof payload !== "object") {
    return new Response(JSON.stringify({ ok: false, error: "bad request" }), { status: 400 });
  }
  const collection = type === "lead" ? "leads" : "claims";
  const webhookUrl =
    type === "lead" ? import.meta.env.GHL_LEAD_WEBHOOK : import.meta.env.GHL_CLAIM_WEBHOOK;

  if (!webhookUrl) {
    console.log(`webhook-forward: no ${type} webhook configured — skipping (record is in CMS)`);
    return new Response(JSON.stringify({ ok: true, forwarded: false }), { status: 200 });
  }

  const outbound = {
    ...payload,
    type,
    itemId: itemId ?? null,
    sourceUrl: request.headers.get("referer") ?? "",
    userAgent: request.headers.get("user-agent") ?? "",
    forwardedAt: new Date().toISOString(),
  };

  let delivered = false;
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outbound),
      });
      if (res.ok) {
        delivered = true;
        break;
      }
      lastError = `HTTP ${res.status}`;
    } catch (err: any) {
      lastError = err?.message ?? String(err);
    }
    await new Promise((r) => setTimeout(r, 500 * 4 ** (attempt - 1)));
  }

  // Best-effort webhookLog on the record (needs elevation; failure only logs).
  if (itemId) {
    const logLine = delivered
      ? `delivered ${new Date().toISOString()}`
      : `FAILED after 3 attempts (${lastError}) ${new Date().toISOString()}`;
    try {
      const { auth } = await import("@wix/essentials");
      const data: any = await import("@wix/data");
      const getItem = auth.elevate(data.items.getDataItem);
      const updateItem = auth.elevate(data.items.updateDataItem);
      const current: any = await getItem(itemId, { dataCollectionId: collection });
      const prior = current?.data?.webhookLog ? `${current.data.webhookLog}\n` : "";
      await updateItem(itemId, {
        dataCollectionId: collection,
        dataItem: { data: { ...current.data, webhookLog: `${prior}${logLine}` } },
      });
    } catch (err) {
      console.error(`webhook-forward: webhookLog write failed for ${collection}/${itemId}`, err);
    }
  }

  if (!delivered) console.error(`webhook-forward: ${type} delivery failed: ${lastError}`);
  return new Response(JSON.stringify({ ok: true, forwarded: delivered }), { status: 200 });
};
