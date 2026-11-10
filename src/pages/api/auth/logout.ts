import type { APIRoute } from "astro";
import { endSession, clearCookie } from "@/platform/auth";

// Ends the session on this device. The dashboard's sign-out posts a form here.
// POST only, so a link on another site can't sign people out.
const signOut: APIRoute = async ({ request, url }) => {
  await endSession(request.headers.get("cookie")).catch(() => {});
  return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": clearCookie(url.protocol === "https:") } });
};
export const POST = signOut;
