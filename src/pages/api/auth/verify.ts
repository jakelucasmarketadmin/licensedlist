import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";
import { verifyLogin, sessionCookie, AuthError } from "@/platform/auth";

// Step 2 of signing in: check the code and start a session.
export const POST: APIRoute = async ({ request, url }) => {
  const body: any = await request.json().catch(() => ({}));
  try {
    const { token, member } = await verifyLogin(body.email, body.code);
    const res = json({ ok: true, role: member.role });
    res.headers.append("Set-Cookie", sessionCookie(token, url.protocol === "https:"));
    return res;
  } catch (e) {
    if (e instanceof AuthError) return json({ ok: false, error: e.message }, 400);
    console.error("login verify failed", e);
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
};
