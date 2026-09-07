import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";

/**
 * TEMPORARY unclaimed-listings setup endpoint — DELETE before publishing.
 *
 * steps:
 *   schema → add listingSource / notifiedAt / optOutAt fields to businesses
 *   upsert → insert/update business rows (array; keyed by slug; SKIPS any
 *            existing row with optOutAt set — opt-outs never resurrect)
 *   status → flip a list of slugs between draft/published (tranche releases)
 */
const SEED_SECRET = "tv-uncl-9a4d7f2e5b8c1a6e3d0f7b4c9e2a5d8f";

const T = (key: string) => ({ key, type: "TEXT" });

async function tools() {
  const { auth } = await import("@wix/essentials");
  const data: any = await import("@wix/data");
  return {
    q: auth.elevate(data.items.query) as any,
    insert: auth.elevate(data.items.insert) as any,
    update: auth.elevate(data.items.update) as any,
    getCollection: auth.elevate(data.collections.getDataCollection) as any,
    updateCollection: auth.elevate(data.collections.updateDataCollection) as any,
  };
}

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get("x-seed-secret") !== SEED_SECRET)
    return json({ ok: false, error: "forbidden" }, 403);
  let body: any = {};
  try {
    body = await request.json();
  } catch { /* default */ }
  const step = body.step ?? "schema";

  try {
    const t = await tools();

    if (step === "schema") {
      const existing: any = await t.getCollection("businesses");
      const have = new Set((existing.fields ?? []).map((f: any) => f.key));
      const wanted = [T("listingSource"), T("notifiedAt"), T("optOutAt")];
      const missing = wanted.filter((f) => !have.has(f.key));
      if (missing.length)
        await t.updateCollection({ ...existing, fields: [...existing.fields, ...missing] });
      return json({ ok: true, added: missing.map((f) => f.key) });
    }

    if (step === "upsert") {
      const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
      if (!rows.length || rows.length > 50) return json({ ok: false, error: "1-50 rows" }, 400);
      const log: string[] = [];
      for (const row of rows) {
        if (!row.slug) { log.push("SKIP row without slug"); continue; }
        const res: any = await t.q("businesses").eq("slug", row.slug).find();
        const hit = res?.items?.[0];
        const current = hit ? (hit.data ?? hit) : null;
        if (current?.optOutAt) { log.push(`SKIP ${row.slug} — optOutAt set (never re-add)`); continue; }
        if (current) {
          await t.update("businesses", { ...current, ...row, _id: hit._id ?? hit.id });
          log.push(`update ${row.slug} (${row.status})`);
        } else {
          await t.insert("businesses", row);
          log.push(`insert ${row.slug} (${row.status})`);
        }
      }
      return json({ ok: true, log });
    }

    if (step === "status") {
      const slugs: string[] = Array.isArray(body.slugs) ? body.slugs : [];
      const status = String(body.status ?? "");
      if (!slugs.length || !["draft", "published"].includes(status))
        return json({ ok: false, error: "slugs + status(draft|published) required" }, 400);
      const log: string[] = [];
      for (const slug of slugs) {
        const res: any = await t.q("businesses").eq("slug", slug).find();
        const hit = res?.items?.[0];
        if (!hit) { log.push(`MISSING ${slug}`); continue; }
        const current = hit.data ?? hit;
        await t.update("businesses", { ...current, status, _id: hit._id ?? hit.id });
        log.push(`${slug} → ${status}`);
      }
      return json({ ok: true, log });
    }

    return json({ ok: false, error: "unknown step" }, 400);
  } catch (err: any) {
    console.error("admin-unclaimed failed", err);
    return json({ ok: false, error: err?.message ?? String(err) }, 500);
  }
};
