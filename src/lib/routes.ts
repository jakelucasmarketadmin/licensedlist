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
