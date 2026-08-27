import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";
import { rejectReason, normalizeName } from "@/lib/registry-normalize";

/**
 * TEMPORARY Batch D setup endpoint — DELETE before publishing (same
 * discipline as B/C0/C seed endpoints).
 *
 * steps:
 *   cleanup → R-fix 1 migration over existing status=registered rows:
 *             reject junk names (bulk remove), normalize the rest (bulk
 *             update), paced for the WDE0014 per-minute quota. Processes up
 *             to `limit` rows per call from `skip`; re-run advancing skip.
 *             Returns rejects for the local rejects CSV.
 *   schema  → create savedLists / intentLogs / aiSummaries / conciergeLogs.
 *   counts  → registered row count + per-collection counts.
 */
const SEED_SECRET = "tv-d-admin-5c1e8f3a7b9d2e6c4a0f8b5d3e7c1a9f";

const T = (key: string) => ({ key, type: "TEXT" });
const N = (key: string) => ({ key, type: "NUMBER" });

const COLLECTIONS = [
  { id: "savedLists", displayName: "Saved Lists", fields: [T("memberId"), T("name"), T("slugsJson")] },
  { id: "intentLogs", displayName: "Intent Logs", fields: [T("query"), T("parsedJson"), T("matchedCategory"), T("matchedTown"), T("source"), T("outcome")] },
  { id: "aiSummaries", displayName: "AI Summaries", fields: [T("businessSlug"), T("kind"), T("summaryJson"), T("inputHash"), N("reviewCount")] },
  { id: "conciergeLogs", displayName: "Concierge Logs", fields: [T("question"), T("answeredFrom"), T("outcome")] },
];

async function tools() {
  const { auth } = await import("@wix/essentials");
  const data: any = await import("@wix/data");
  return {
    q: auth.elevate(data.items.query) as any,
    bulkUpdate: (data.items.bulkUpdate ? auth.elevate(data.items.bulkUpdate) : null) as any,
    bulkRemove: (data.items.bulkRemove ? auth.elevate(data.items.bulkRemove) : null) as any,
    update: auth.elevate(data.items.update) as any,
    remove: auth.elevate(data.items.remove) as any,
    getCollection: auth.elevate(data.collections.getDataCollection) as any,
    createCollection: auth.elevate(data.collections.createDataCollection) as any,
  };
}

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get("x-seed-secret") !== SEED_SECRET)
    return json({ ok: false, error: "forbidden" }, 403);
  let body: any = {};
  try {
    body = await request.json();
  } catch { /* default */ }
  const step = body.step ?? "counts";

  try {
    const t = await tools();

    if (step === "schema") {
      const log: string[] = [];
      for (const c of COLLECTIONS) {
        let exists = false;
        try {
          await t.getCollection(c.id);
          exists = true;
        } catch { /* create */ }
        if (exists) { log.push(`${c.id}: exists`); continue; }
        await t.createCollection({
          _id: c.id,
          displayName: c.displayName,
          fields: c.fields,
          permissions: { insert: "ADMIN", update: "ADMIN", remove: "ADMIN", read: "ADMIN" },
        });
        log.push(`${c.id}: created`);
      }
      return json({ ok: true, log });
    }

    if (step === "cleanup") {
      const skip = Number(body.skip) || 0;
      const limit = Math.min(Number(body.limit) || 1000, 1000);
      const res = await t.q("businesses").eq("status", "registered").ascending("_id").limit(limit).skip(skip).find();
      const items: any[] = res?.items ?? [];
      const removals: any[] = [];
      const renames: any[] = [];
      const rejects: { licenseNumber: string; rawName: string; reason: string }[] = [];
      for (const it of items) {
        const src = it.data ?? it;
        const reason = rejectReason(src.name);
        if (reason) {
          removals.push(it._id ?? it.id);
          rejects.push({ licenseNumber: src.licenseNumber ?? "", rawName: src.name ?? "", reason });
          continue;
        }
        const clean = normalizeName(src.name);
        if (clean !== src.name) renames.push({ ...src, _id: it._id ?? it.id, name: clean });
      }
      if (removals.length) {
        if (t.bulkRemove) await t.bulkRemove("businesses", removals);
        else for (const id of removals) await t.remove("businesses", id);
      }
      for (let i = 0; i < renames.length; i += 200) {
        const batch = renames.slice(i, i + 200);
        if (t.bulkUpdate) await t.bulkUpdate("businesses", batch);
        else for (const row of batch) await t.update("businesses", row);
        await new Promise((r) => setTimeout(r, 1500));
      }
      return json({
        ok: true,
        scanned: items.length,
        removed: removals.length,
        renamed: renames.length,
        rejects,
        done: items.length < limit,
      });
    }

    // counts
    const counts: Record<string, number | string> = {};
    for (const c of [...COLLECTIONS.map((x) => x.id)]) {
      try {
        const res: any = await t.q(c).find();
        counts[c] = (res?.items ?? []).length;
      } catch (e: any) {
        counts[c] = `ERR ${String(e?.message ?? e).slice(0, 60)}`;
      }
    }
    const reg = await t.q("businesses").eq("status", "registered").limit(1).find();
    counts.registeredSample = reg?.items?.length ?? 0;
    return json({ ok: true, counts });
  } catch (err: any) {
    console.error("admin-d failed", err);
    return json({ ok: false, error: err?.message ?? String(err) }, 500);
  }
};
