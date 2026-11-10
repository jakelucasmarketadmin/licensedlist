import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";

// Who is signed in, for the owner dashboard's React islands.
export const GET: APIRoute = async () => {
  const member = (globalThis as any).__currentMember?.() ?? null;
  const res = json({ member });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
};
