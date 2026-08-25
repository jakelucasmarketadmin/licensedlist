import { SITE_NAME } from "./site";
import type { PageSeo } from "./seo";

/**
 * SEO data for every static route. The catch-all page maps these paths to
 * views; the sitemap endpoints emit every entry whose robots don't include
 * noindex. Dynamic routes (hubs, listings) register in their own modules.
 */
export const ROUTE_SEO: Record<string, PageSeo> = {
  "/": {
    title: `${SITE_NAME} · Verified Local Pros in NJ, NY & PA`,
    description:
      "Find licensed, vetted local businesses across New Jersey, New York & Pennsylvania. Every verified badge names the official state registry it was checked against — and the date we checked.",
    path: "/",
    crumb: "Home",
  },
  "/how-we-verify": {
    title: `How We Verify Local Businesses · ${SITE_NAME}`,
    description:
      "The exact checks behind every badge: identity, license verification against official state registries, cross-platform review analysis, and responsiveness — plus how listings are ordered.",
    path: "/how-we-verify",
    crumb: "How we verify",
  },
  "/for-businesses": {
    title: `List Your Business · ${SITE_NAME}`,
    description:
      "Claim your free listing and get your license verified against the official state registry. Paid placement is always labeled and never changes rankings or reviews.",
    path: "/for-businesses",
    crumb: "For businesses",
  },
  "/for-businesses/get-listed": {
    title: `Get Listed · ${SITE_NAME}`,
    description: `Tell us about your business and we'll build your ${SITE_NAME} listing, run license verification, and send it to you for review. Free — no credit card.`,
    path: "/for-businesses/get-listed",
    crumb: "Get listed",
  },
  "/for-businesses/get-listed-basic": {
    title: `Get Listed (Basic Form) · ${SITE_NAME}`,
    description: `Fallback listing form for ${SITE_NAME} — used when the main intake form is unavailable.`,
    path: "/for-businesses/get-listed-basic",
    robots: "noindex, follow",
    crumb: "Get listed (basic)",
  },
  "/for-businesses/why-verified": {
    title: `Why a Verified Listing Is Worth Having · ${SITE_NAME}`,
    description:
      "A badge homeowners can check against the official registry, rankings money can't touch, and leads with recorded consent — why businesses list on the tri-state's verified directory.",
    path: "/for-businesses/why-verified",
    crumb: "Why verified",
  },
  "/about": {
    title: `About · ${SITE_NAME}`,
    description:
      "Why we built a local directory that verifies licenses against official state registries — and the disclosures that keep it honest.",
    path: "/about",
    crumb: "About",
  },
  "/editorial-policy": {
    title: `Editorial Policy · ${SITE_NAME}`,
    description:
      "The rules we can't break: money never buys ranking, paid placement is always labeled, reviews are never gated, and every fact has a source.",
    path: "/editorial-policy",
    crumb: "Editorial policy",
  },
  "/privacy": {
    title: `Privacy Policy · ${SITE_NAME}`,
    description: `What ${SITE_NAME} collects, how quote requests are shared with local businesses, and the choices you have over your information.`,
    path: "/privacy",
    crumb: "Privacy",
  },
  "/terms": {
    title: `Terms of Use · ${SITE_NAME}`,
    description: `The terms for using ${SITE_NAME}: what verification means, review standards, and the rules for business listings.`,
    path: "/terms",
    crumb: "Terms",
  },
  "/categories": {
    title: `All Categories · ${SITE_NAME}`,
    description:
      "Every service category we cover across New Jersey, New York & Pennsylvania — from licensed trades to local professionals.",
    path: "/categories",
    crumb: "Categories",
  },
  "/pricing": {
    title: `Plans & Pricing for Businesses · ${SITE_NAME}`,
    description:
      "Free listings forever. Verified $29/mo, Featured $99/mo (max 3 per category per county). Paid placement is always labeled and never changes rankings or reviews.",
    path: "/pricing",
    crumb: "Pricing",
  },
  "/claim": {
    title: `Claim Your Business Listing · ${SITE_NAME}`,
    description:
      "Find your business, verify you own it, and take control of your listing — free forever, no credit card.",
    path: "/claim",
    crumb: "Claim your listing",
  },
  "/owner": {
    title: `Owner Dashboard · ${SITE_NAME}`,
    description: "Sign in to manage your business listing — description, hours, photos, services, and contact details.",
    path: "/owner",
    robots: "noindex, follow",
    crumb: "Owner dashboard",
  },
  "/search": {
    title: `Search · ${SITE_NAME}`,
    description: `Search ${SITE_NAME} for verified local businesses in New Jersey, New York & Pennsylvania.`,
    path: "/search",
    robots: "noindex, follow",
    crumb: "Search",
  },
};

/** Paths that belong in the sitemap (indexable static routes). */
export function sitemapPaths(): string[] {
  return Object.values(ROUTE_SEO)
    .filter((seo) => !(seo.robots ?? "").includes("noindex"))
    .map((seo) => seo.path);
}
