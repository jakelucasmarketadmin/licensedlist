import type { APIRoute } from "astro";

// The owner dashboard's "Sign in" button still points here (from the Wix days).
export const GET: APIRoute = ({ url, redirect }) => {
  const back = url.searchParams.get("returnToUrl") || "/owner";
  const next = back.startsWith("/") && !back.startsWith("//") ? back : "/owner";
  return redirect(`/login?next=${encodeURIComponent(next)}`, 302);
};
