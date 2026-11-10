/**
 * Stand-ins for the Wix services that have no Cloudflare equivalent yet.
 * Each one fails safely, and the template's unused shop code never runs.
 */

// @wix/essentials: elevation was Wix's admin mode. Server code here already
// runs with full database access, so it passes the function through.
export const auth = { elevate: <T>(fn: T): T => fn };

// @wix/members: the signed-in owner or admin. On the server the middleware
// knows who it is; in the browser it asks /api/auth/me.
export const members = {
  getCurrentMember: async () => {
    if (typeof window === "undefined") return { member: (globalThis as any).__currentMember?.() ?? null };
    const res = await fetch("/api/auth/me", { credentials: "same-origin" }).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => ({})) : {};
    return { member: body.member ?? null };
  },
};

// @wix/ecom and @wix/redirects: template shop code, not used by any page.
const unavailable = () => { throw new Error("The shop isn't available on this site."); };
export const currentCart = { getCurrentCart: unavailable, addToCurrentCart: unavailable, removeLineItemsFromCurrentCart: unavailable, updateCurrentCartLineItemQuantity: unavailable, createCheckoutFromCurrentCart: unavailable, estimateCurrentCartTotals: unavailable };
export const checkout = { createCheckout: unavailable };
export const redirects = { createRedirectSession: unavailable };

// @wix/astro-pages is imported for a type only.
export type PageMetadata = Record<string, unknown>;
export default {};
