import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";
import { startLogin, AuthError } from "@/platform/auth";

// Step 1 of signing in: email a 6-digit code.
export const POST: APIRoute = async ({ request, locals, url }) => {
  const body: any = await request.json().catch(() => ({}));
  try {
    await startLogin(body.email, (locals as any).runtime?.env ?? {}, url.hostname);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return json({ ok: false, error: e.message }, 400);
    console.error("login start failed", e);
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
};
