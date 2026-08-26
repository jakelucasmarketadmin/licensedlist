import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";

/**
 * TEMPORARY registry-ingest endpoint (C0) — run on the dev preview origin
 * with scripts/seed-registry.ts, then DELETE before publishing.
 *
 * steps:
 *   schema  → add licenseExpiresAt / foundingMember / foundingCounty fields
 *   ingest  → bulk-insert registered rows (dedupe by licenseNumber, then
 *             normalized name+zip, against BOTH registry and directory rows —
 *             a published client never gets a duplicate registry shadow)
 *   counts  → status/county breakdown
 *   purge   → remove ALL status=registered rows for a given sourceNotes
 *             prefix (rollback hatch; requires confirm:"yes")
 */
const SEED_SECRET = "tv-c0-registry-7b3e9d1f5a8c2e6b4d7f0a3c9e5b1d8f";

const T = (key: string) => ({ key, type: "TEXT" });
const B = (key: string) => ({ key, type: "BOOLEAN" });

async function tools() {
  const { auth } = await import("@wix/essentials");
  const data: any = await import("@wix/data");
  return {
    q: auth.elevate(data.items.query) as any,
    insert: auth.elevate(data.items.insert) as any,
    bulkInsert: (data.items.bulkInsert ? auth.elevate(data.items.bulkInsert) : null) as any,
    remove: auth.elevate(data.items.remove) as any,
    bulkRemove: (data.items.bulkRemove ? auth.elevate(data.items.bulkRemove) : null) as any,
    getCollection: auth.elevate(data.collections.getDataCollection) as any,
    updateCollection: auth.elevate(data.collections.updateDataCollection) as any,
  };
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

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
      const existing: any = await t.getCollection("businesses");
      const have = new Set((existing.fields ?? []).map((f: any) => f.key));
      const wanted = [T("licenseExpiresAt"), T("foundingCounty"), B("foundingMember")];
      const missing = wanted.filter((f) => !have.has(f.key));
      if (missing.length)
        await t.updateCollection({ ...existing, fields: [...existing.fields, ...missing] });
      return json({ ok: true, added: missing.map((f) => f.key) });
    }

    if (step === "ingest") {
      const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
      if (!rows.length) return json({ ok: false, error: "no rows" }, 400);
      if (rows.length > 200) return json({ ok: false, error: "max 200 rows per batch" }, 400);

      // Existing keys: license numbers + name|zip across the whole collection
      // (registry + directory), paged.
      const licSeen = new Set<string>();
      const nzSeen = new Set<string>();
      let skip = 0;
      for (;;) {
        const res = await t.q("businesses").limit(1000).skip(skip).find();
        const items: any[] = res?.items ?? [];
        for (const it of items) {
          const src = it.data ?? it;
          if (src.licenseNumber) licSeen.add(norm(src.licenseNumber));
          if (src.name) nzSeen.add(`${norm(src.name)}|${norm(src.zip)}`);
        }
        if (items.length < 1000) break;
        skip += 1000;
        if (skip > 40000) break;
      }

      const fresh: any[] = [];
      let skipped = 0;
      for (const r of rows) {
        const lic = norm(r.licenseNumber);
        const nz = `${norm(r.name)}|${norm(r.zip)}`;
        if ((lic && licSeen.has(lic)) || nzSeen.has(nz)) { skipped++; continue; }
        licSeen.add(lic);
        nzSeen.add(nz);
        fresh.push({
          ...r,
          claimed: false,
          isClient: false,
          foundingMember: false,
        });
      }

      let inserted = 0;
      if (fresh.length) {
        if (t.bulkInsert) {
          const res: any = await t.bulkInsert("businesses", fresh);
          inserted = res?.results?.length ?? res?.inserted ?? fresh.length;
        } else {
          for (const row of fresh) {
            await t.insert("businesses", row);
            inserted++;
          }
        }
      }
      return json({ ok: true, inserted, skipped });
    }

    if (step === "purge") {
      if (body.confirm !== "yes") return json({ ok: false, error: "confirm required" }, 400);
      const prefix = String(body.sourcePrefix ?? "REGISTRY");
      // bulkRemove in paced batches; returns after ≤10 batches (re-run until
      // remaining=0) to stay inside the per-minute request quota (WDE0014).
      let removed = 0;
      for (let round = 0; round < 10; round++) {
        const res = await t.q("businesses").eq("status", "registered").limit(1000).find();
        const ids: string[] = (res?.items ?? [])
          .filter((it: any) => String((it.data ?? it).sourceNotes ?? "").startsWith(prefix))
          .map((it: any) => it._id ?? it.id);
        if (!ids.length) return json({ ok: true, removed, remaining: 0 });
        if (t.bulkRemove) {
          const r: any = await t.bulkRemove("businesses", ids.slice(0, 500));
          removed += ids.slice(0, 500).length;
          void r;
        } else {
          for (const id of ids.slice(0, 100)) {
            await t.remove("businesses", id);
            removed++;
          }
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      return json({ ok: true, removed, remaining: "unknown — run purge again" });
    }

    // counts
    const byStatus: Record<string, number> = {};
    const byCounty: Record<string, number> = {};
    let skip = 0;
    for (;;) {
      const res = await t.q("businesses").limit(1000).skip(skip).find();
      const items: any[] = res?.items ?? [];
      for (const it of items) {
        const src = it.data ?? it;
        byStatus[src.status ?? "?"] = (byStatus[src.status ?? "?"] ?? 0) + 1;
        if (src.status === "registered") {
          const key = `${src.stateSlug}/${src.countySlug}/${src.primaryCategorySlug}`;
          byCounty[key] = (byCounty[key] ?? 0) + 1;
        }
      }
      if (items.length < 1000) break;
      skip += 1000;
      if (skip > 40000) break;
    }
    return json({ ok: true, byStatus, byCounty });
  } catch (err: any) {
    console.error("admin-registry failed", err);
    return json({ ok: false, error: err?.message ?? String(err) }, 500);
  }
};
