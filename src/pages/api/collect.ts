import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";
import { items } from "@/platform/wix/data";

/**
 * Where the public forms save (claim, get listed, featured request, quote).
 * On Wix these collections used the "Collect content" preset: anyone can add
 * an item, only admins can read. This keeps that rule: insert only, into
 * `claims` and `leads` only, and fields the directory controls are dropped.
 */
const OPEN = new Set(["claims", "leads"]);
const PROTECTED = /^(_|status$|approved|memberId$|tier$|verified)/i;

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  if (raw.length > 20000) return json({ error: "That was too much to send." }, 413);
  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: "That didn't send. Please try again." }, 400); }
  if (!OPEN.has(body?.collection)) return json({ error: "Not allowed." }, 403);
  const input = body.item && typeof body.item === "object" ? body.item : {};
  const item: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (PROTECTED.test(k)) continue;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) continue;
    item[k] = typeof v === "string" ? v.slice(0, 4000) : v;
  }
  // New submissions always start in the review queue, as the forms set them on Wix.
  item.status = "new";
  const saved = await items.insert(body.collection, item);
  return json({ item: { _id: saved._id } });
};
