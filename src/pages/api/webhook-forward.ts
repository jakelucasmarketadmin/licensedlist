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
export const POST: APIRoute = async ({ request, url }) => {
  // Two callers: our own forms POST JSON {type, itemId, payload}; the Jotform
  // webhook integration POSTs multipart/form-data (rawRequest et al.) with the
  // type carried as ?type=claim on the URL pasted into Jotform.
  let type: string | undefined;
  let itemId: string | undefined;
  let payload: any;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "bad json" }), { status: 400 });
    }
    ({ type, itemId, payload } = body ?? {});
  } else {
    try {
      const form = await request.formData();
      payload = Object.fromEntries(
        [...form.entries()].filter(([, v]) => typeof v === "string"),
      );
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "bad body" }), { status: 400 });
    }
    type = url.searchParams.get("type") ?? "claim";
  }
  if ((type !== "lead" && type !== "claim") || typeof payload !== "object" || payload === null) {
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
      const { elevatedData } = await import("@/lib/server-data");
      const { getItem, updateItem } = await elevatedData();
      const current: any = await getItem(itemId, { dataCollectionId: collection });
      const cur = current?.data ?? current ?? {};
      const prior = cur.webhookLog ? `${cur.webhookLog}\n` : "";
      await updateItem(itemId, {
        dataCollectionId: collection,
        dataItem: { data: { ...cur, webhookLog: `${prior}${logLine}` } },
      });
    } catch (err) {
      console.error(`webhook-forward: webhookLog write failed for ${collection}/${itemId}`, err);
    }
  }

  if (!delivered) console.error(`webhook-forward: ${type} delivery failed: ${lastError}`);
  return new Response(JSON.stringify({ ok: true, forwarded: delivered }), { status: 200 });
};
