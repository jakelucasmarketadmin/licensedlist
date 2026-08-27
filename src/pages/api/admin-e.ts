import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";

/**
 * TEMPORARY Batch E setup — create `metrics` + `posts` collections, then
 * DELETE before publishing.
 */
const SEED_SECRET = "tv-e-admin-8e2c5a9f1d4b7e3a6c0f9b2d5e8a1c4f";
const T = (key: string) => ({ key, type: "TEXT" });
const N = (key: string) => ({ key, type: "NUMBER" });

const COLLECTIONS = [
  { id: "metrics", displayName: "Metrics", fields: [T("day"), T("businessSlug"), T("event"), N("count")] },
  { id: "posts", displayName: "Posts", fields: [T("businessSlug"), T("text"), T("expiresAt")] },
];

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get("x-seed-secret") !== SEED_SECRET)
    return json({ ok: false, error: "forbidden" }, 403);
  try {
    const { auth } = await import("@wix/essentials");
    const data: any = await import("@wix/data");
    const getCollection = auth.elevate(data.collections.getDataCollection) as any;
    const createCollection = auth.elevate(data.collections.createDataCollection) as any;
    const log: string[] = [];
    for (const c of COLLECTIONS) {
      let exists = false;
      try {
        await getCollection(c.id);
        exists = true;
      } catch { /* create */ }
      if (exists) { log.push(`${c.id}: exists`); continue; }
      await createCollection({
        _id: c.id,
        displayName: c.displayName,
        fields: c.fields,
        permissions: { insert: "ADMIN", update: "ADMIN", remove: "ADMIN", read: "ADMIN" },
      });
      log.push(`${c.id}: created`);
    }
    return json({ ok: true, log });
  } catch (err: any) {
    return json({ ok: false, error: err?.message ?? String(err) }, 500);
  }
};
