import type { APIRoute } from "astro";
import { elevatedData, json, clean } from "@/lib/server-data";

/**
 * Member saved lists (D1). Signed-in members store named lists of business
 * slugs in `savedLists`; guests keep localStorage only (the /saved page works
 * either way). Every call re-resolves the member server-side.
 *
 * GET → { lists: [{_id, name, slugs}] }
 * POST {action:"upsert", id?, name, slugs[]} | {action:"delete", id}
 */
async function currentMemberId(): Promise<string | null> {
  try {
    const { members } = await import("@wix/members");
    const res: any = await members.getCurrentMember();
    return res?.member?._id ?? res?._id ?? null;
  } catch {
    return null;
  }
}

const rowsFor = async (query: any, memberId: string) => {
  const res: any = await query({ dataCollectionId: "savedLists" }).eq("memberId", memberId).find();
  return (res?.items ?? []).map((it: any) => {
    const src = it.data ?? it;
    let slugs: string[] = [];
    try { slugs = JSON.parse(src.slugsJson || "[]"); } catch { /* empty */ }
    return { _id: it._id ?? it.id, name: src.name ?? "Saved", slugs };
  });
};

export const GET: APIRoute = async () => {
  const memberId = await currentMemberId();
  if (!memberId) return json({ ok: false, error: "sign in required" }, 401);
  try {
    const { query } = await elevatedData();
    return json({ ok: true, lists: await rowsFor(query, memberId) });
  } catch (err) {
    console.error("saved-lists GET failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const memberId = await currentMemberId();
  if (!memberId) return json({ ok: false, error: "sign in required" }, 401);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  try {
    const { query, insertItem, updateItem } = await elevatedData();

    if (body.action === "upsert") {
      const name = clean(body.name, 60) || "Saved";
      const slugs = (Array.isArray(body.slugs) ? body.slugs : [])
        .map((s: unknown) => clean(s, 120))
        .filter(Boolean)
        .slice(0, 100);
      const id = clean(body.id, 64);
      if (id) {
        const mine = await rowsFor(query, memberId);
        if (!mine.some((l: any) => l._id === id)) return json({ ok: false, error: "not found" }, 404);
        await updateItem(id, {
          dataCollectionId: "savedLists",
          dataItem: { data: { memberId, name, slugsJson: JSON.stringify(slugs) } },
        });
        return json({ ok: true, id });
      }
      const created: any = await insertItem({
        dataCollectionId: "savedLists",
        dataItem: { data: { memberId, name, slugsJson: JSON.stringify(slugs) } },
      });
      return json({ ok: true, id: created?._id ?? created?.dataItem?._id ?? null });
    }

    if (body.action === "delete") {
      const id = clean(body.id, 64);
      const mine = await rowsFor(query, memberId);
      if (!mine.some((l: any) => l._id === id)) return json({ ok: false, error: "not found" }, 404);
      const { auth } = await import("@wix/essentials");
      const data: any = await import("@wix/data");
      await (auth.elevate(data.items.remove) as any)("savedLists", id);
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown action" }, 400);
  } catch (err) {
    console.error("saved-lists POST failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
