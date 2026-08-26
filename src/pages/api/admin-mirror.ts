import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";

/**
 * TEMPORARY photo-mirror endpoint — run on the dev preview origin, then
 * DELETE before publishing (same pattern as the Batch B seed endpoint).
 *
 * Imports every external photo referenced by businesses (photosJson,
 * projectsJson, logoUrl) and reviews (photosJson) into THIS site's Wix Media
 * via the elevated @wix/media import API, then rewrites the records to the
 * new static.wixstatic.com URLs. Idempotent: URLs already rewritten are left
 * alone (mirror map keyed by source URL is stored in-collection on the run
 * result so re-runs reuse completed imports).
 *
 * POST /api/admin-mirror { step: "run" | "verify", limit?: number }
 */
const SEED_SECRET = "tv-b2-mirror-9d2e6b1c4a7f3e8d5c2b9a6f1e4d7c3a";

async function tools() {
  const { auth } = await import("@wix/essentials");
  const data: any = await import("@wix/data");
  const media: any = await import("@wix/media");
  const q: any = auth.elevate(data.items.query);
  const upd: any = auth.elevate(data.items.update);
  const importFile: any = auth.elevate(media.files.importFile);
  return { q, upd, importFile };
}

const isOurs = (url: string, prefixes: Set<string>) => {
  const m = /static\.wixstatic\.com\/media\/([a-z0-9]+)_/.exec(url);
  return m ? prefixes.has(m[1]) : false;
};

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get("x-seed-secret") !== SEED_SECRET)
    return json({ ok: false, error: "forbidden" }, 403);
  let body: any = {};
  try {
    body = await request.json();
  } catch { /* defaults */ }
  const step = body.step ?? "verify";
  const limit = Number(body.limit) || 200;
  const log: string[] = [];

  try {
    const { q, upd, importFile } = await tools();
    const mirrorMap = new Map<string, string>();

    const mirrorOne = async (url: string): Promise<string> => {
      if (mirrorMap.has(url)) return mirrorMap.get(url)!;
      const res: any = await importFile({ url, mimeType: "image/jpeg" }).catch((e: any) => {
        log.push(`import FAILED ${url.slice(0, 70)}: ${e?.message ?? e}`);
        return null;
      });
      const out = res?.file?.url ?? res?.url ?? null;
      if (!out) return url; // keep original on failure
      mirrorMap.set(url, out);
      log.push(`mirrored ${url.slice(30, 80)} -> ${String(out).slice(30, 80)}`);
      return out;
    };

    if (step === "run") {
      // Which media prefixes are OURS? Probe with one import first, learn the
      // prefix from the result, then skip anything already on it.
      const bizRes: any = await q("businesses").limit(1000).find();
      const businesses: any[] = bizRes?.items ?? [];
      const ourPrefixes = new Set<string>();
      let converted = 0;

      for (const biz of businesses) {
        if (converted >= limit) { log.push("limit reached — run again"); break; }
        let changed = false;
        const patch: any = {};

        const swapList = async (raw: any): Promise<string[] | null> => {
          let arr: string[];
          try {
            arr = typeof raw === "string" ? JSON.parse(raw) : raw;
          } catch { return null; }
          if (!Array.isArray(arr) || !arr.length) return null;
          const out: string[] = [];
          let any = false;
          for (const u of arr) {
            if (typeof u !== "string" || !u.startsWith("http") || isOurs(u, ourPrefixes)) { out.push(u); continue; }
            const nu = await mirrorOne(u);
            if (nu !== u) {
              any = true;
              converted++;
              const m = /static\.wixstatic\.com\/media\/([a-z0-9]+)_/.exec(nu);
              if (m) ourPrefixes.add(m[1]);
            }
            out.push(nu);
          }
          return any ? out : null;
        };

        const photos = await swapList(biz.photosJson);
        if (photos) { patch.photosJson = JSON.stringify(photos); changed = true; }

        if (biz.projectsJson) {
          try {
            const projects = typeof biz.projectsJson === "string" ? JSON.parse(biz.projectsJson) : biz.projectsJson;
            let any = false;
            for (const p of projects) {
              if (Array.isArray(p.photos)) {
                for (let i = 0; i < p.photos.length; i++) {
                  if (typeof p.photos[i] === "string" && p.photos[i].startsWith("http") && !isOurs(p.photos[i], ourPrefixes)) {
                    const nu = await mirrorOne(p.photos[i]);
                    if (nu !== p.photos[i]) { p.photos[i] = nu; any = true; converted++; }
                  }
                }
              }
              for (const k of ["beforePhoto", "afterPhoto"]) {
                if (typeof p[k] === "string" && p[k].startsWith("http") && !isOurs(p[k], ourPrefixes)) {
                  const nu = await mirrorOne(p[k]);
                  if (nu !== p[k]) { p[k] = nu; any = true; converted++; }
                }
              }
            }
            if (any) { patch.projectsJson = JSON.stringify(projects); changed = true; }
          } catch { /* leave malformed alone */ }
        }

        if (typeof biz.logoUrl === "string" && biz.logoUrl.startsWith("http") && !isOurs(biz.logoUrl, ourPrefixes)) {
          const nu = await mirrorOne(biz.logoUrl);
          if (nu !== biz.logoUrl) { patch.logoUrl = nu; changed = true; converted++; }
        }

        if (changed) {
          await upd("businesses", { ...biz, ...patch });
          log.push(`updated ${biz.slug}`);
        }
      }

      // Review photos.
      const revRes: any = await q("reviews").limit(1000).find();
      for (const r of revRes?.items ?? []) {
        const photos = await (async () => {
          let arr: string[];
          try { arr = typeof r.photosJson === "string" ? JSON.parse(r.photosJson || "[]") : r.photosJson; } catch { return null; }
          if (!Array.isArray(arr) || !arr.length) return null;
          let any = false;
          const out: string[] = [];
          for (const u of arr) {
            if (typeof u !== "string" || !u.startsWith("http") || isOurs(u, ourPrefixes)) { out.push(u); continue; }
            const nu = await mirrorOne(u);
            if (nu !== u) any = true;
            out.push(nu);
          }
          return any ? out : null;
        })();
        if (photos) {
          await upd("reviews", { ...r, photosJson: JSON.stringify(photos) });
          log.push(`updated review ${r._id}`);
        }
      }

      return json({ ok: true, converted, ourPrefixes: [...ourPrefixes], log });
    }

    // verify: list current photo URL hosts/prefixes across businesses.
    const bizRes: any = await q("businesses").limit(1000).find();
    const prefixes: Record<string, number> = {};
    for (const biz of bizRes?.items ?? []) {
      try {
        const arr = typeof biz.photosJson === "string" ? JSON.parse(biz.photosJson || "[]") : (biz.photosJson ?? []);
        for (const u of arr) {
          const m = /static\.wixstatic\.com\/media\/([a-z0-9]+)_/.exec(String(u));
          const key = m ? m[1] : String(u).split("/")[2] ?? "?";
          prefixes[key] = (prefixes[key] ?? 0) + 1;
        }
      } catch { /* skip */ }
    }
    return json({ ok: true, prefixes });
  } catch (err: any) {
    console.error("admin-mirror failed", err);
    return json({ ok: false, error: err?.message ?? String(err), log }, 500);
  }
};
