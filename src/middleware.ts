import { defineMiddleware } from "astro:middleware";
import { setDb } from "./platform/db";

export const onRequest = defineMiddleware(async (context, next) => {
  // Hands Cloudflare's D1 binding to the data layer for this request.
  setDb((context.locals as any).runtime?.env?.DB);
  const response = await next();
  // Cloudflare's own addresses (licensedlist.pages.dev and its previews) are
  // copies of the real site, so search engines must only index the real domain.
  if (context.url.hostname.endsWith(".pages.dev")) response.headers.set("X-Robots-Tag", "noindex");
  return response;
});
