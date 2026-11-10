import { defineMiddleware } from "astro:middleware";
import { AsyncLocalStorage } from "node:async_hooks";
import { setDb } from "./platform/db";
import { memberFromCookie, type Member } from "./platform/auth";

// Who is signed in, for this request only. The @wix/members stand-in reads it,
// so the owner routes that were written for Wix keep working unchanged.
const signedIn = new AsyncLocalStorage<Member | null>();
(globalThis as any).__currentMember = () => signedIn.getStore() ?? null;

export const onRequest = defineMiddleware(async (context, next) => {
  const env = (context.locals as any).runtime?.env ?? {};
  // Hands Cloudflare's D1 binding to the data layer for this request.
  setDb(env.DB);
  let member: Member | null = null;
  try { member = await memberFromCookie(context.request.headers.get("cookie")); } catch { member = null; }

  // The admin area and its API are for admins only.
  const path = context.url.pathname;
  if ((path === "/admin" || path.startsWith("/admin/")) && member?.role !== "admin") {
    return context.redirect(`/login?next=${encodeURIComponent(path)}`, 302);
  }
  if (path.startsWith("/api/admin/") && member?.role !== "admin") {
    return new Response(JSON.stringify({ ok: false, error: "admins-only" }), { status: member ? 403 : 401, headers: { "content-type": "application/json" } });
  }

  const response = await signedIn.run(member, () => next());
  // Cloudflare's own addresses (licensedlist.pages.dev and its previews) are
  // copies of the real site, so search engines must only index the real domain.
  if (context.url.hostname.endsWith(".pages.dev")) response.headers.set("X-Robots-Tag", "noindex");
  // Signed-in pages must never be cached and shown to someone else.
  if (member) response.headers.set("Cache-Control", "private, no-store");
  return response;
});
