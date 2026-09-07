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
    updated: "2026-08-27",
    crumb: "Home",
  },
  "/how-we-verify": {
    title: `How We Verify Local Businesses · ${SITE_NAME}`,
    description:
      "The exact checks behind every badge: identity, license verification against official state registries, cross-platform review analysis, and responsiveness — plus how listings are ordered.",
    path: "/how-we-verify",
    updated: "2026-08-27",
    crumb: "How we verify",
  },
  "/for-businesses": {
    title: `List Your Business · ${SITE_NAME}`,
    description:
      "Claim your free listing and get your license verified against the official state registry. Paid placement is always labeled and never changes rankings or reviews.",
    path: "/for-businesses",
    updated: "2026-08-27",
    crumb: "For businesses",
  },
  "/for-businesses/get-listed": {
    title: `Get Listed · ${SITE_NAME}`,
    description: `Tell us about your business and we'll build your ${SITE_NAME} listing, run license verification, and send it to you for review. Free — no credit card.`,
    path: "/for-businesses/get-listed",
    updated: "2026-08-27",
    crumb: "Get listed",
  },
  "/for-businesses/get-listed-basic": {
    title: `Get Listed (Basic Form) · ${SITE_NAME}`,
    description: `Fallback listing form for ${SITE_NAME} — used when the main intake form is unavailable.`,
    path: "/for-businesses/get-listed-basic",
    updated: "2026-08-27",
    robots: "noindex, follow",
    crumb: "Get listed (basic)",
  },
  "/for-businesses/why-verified": {
    title: `Why a Verified Listing Is Worth Having · ${SITE_NAME}`,
    description:
      "A badge homeowners can check against the official registry, rankings money can't touch, and leads with recorded consent — why businesses list on the tri-state's verified directory.",
    path: "/for-businesses/why-verified",
    updated: "2026-08-27",
    crumb: "Why verified",
  },
  "/about": {
    title: `About · ${SITE_NAME}`,
    description:
      "Why we built a local directory that verifies licenses against official state registries — and the disclosures that keep it honest.",
    path: "/about",
    updated: "2026-08-27",
    crumb: "About",
  },
  "/editorial-policy": {
    title: `Editorial Policy · ${SITE_NAME}`,
    description:
      "The rules we can't break: money never buys ranking, paid placement is always labeled, reviews are never gated, and every fact has a source.",
    path: "/editorial-policy",
    updated: "2026-08-27",
    crumb: "Editorial policy",
  },
  "/privacy": {
    title: `Privacy Policy · ${SITE_NAME}`,
    description: `What ${SITE_NAME} collects, how quote requests are shared with local businesses, and the choices you have over your information.`,
    path: "/privacy",
    updated: "2026-08-27",
    crumb: "Privacy",
  },
  "/terms": {
    title: `Terms of Use · ${SITE_NAME}`,
    description: `The terms for using ${SITE_NAME}: what verification means, review standards, and the rules for business listings.`,
    path: "/terms",
    updated: "2026-08-27",
    crumb: "Terms",
  },
  "/categories": {
    title: `All Categories · ${SITE_NAME}`,
    description:
      "Every service category we cover across New Jersey, New York & Pennsylvania — from licensed trades to local professionals.",
    path: "/categories",
    updated: "2026-08-27",
    crumb: "Categories",
  },
  "/pricing": {
    title: `Plans & Pricing for Businesses · ${SITE_NAME}`,
    description:
      "Free listings forever. Verified $29/mo, Featured $99/mo (max 3 per category per county). Paid placement is always labeled and never changes rankings or reviews.",
    path: "/pricing",
    updated: "2026-08-27",
    crumb: "Pricing",
  },
  "/claim": {
    title: `Claim Your Business Listing · ${SITE_NAME}`,
    description:
      "Find your business, verify you own it, and take control of your listing — free forever, no credit card.",
    path: "/claim",
    updated: "2026-08-27",
    crumb: "Claim your listing",
  },
  "/owner": {
    title: `Owner Dashboard · ${SITE_NAME}`,
    description: "Sign in to manage your business listing — description, hours, photos, services, and contact details.",
    path: "/owner",
    updated: "2026-08-27",
    robots: "noindex, follow",
    crumb: "Owner dashboard",
  },
  "/credits": {
    title: `Photo Credits · ${SITE_NAME}`,
    description: "Attribution for the town and county photography used across the directory — every image links to its Wikimedia Commons source and license.",
    path: "/credits",
    updated: "2026-08-27",
    crumb: "Photo credits",
  },
  "/events": {
    title: `Local Events in NJ, NY & PA · ${SITE_NAME}`,
    description:
      "Community events across the New Jersey, New York, and Pennsylvania towns LicensedList covers — submitted locally, checked before publishing.",
    path: "/events",
    updated: "2026-08-27",
    crumb: "Events",
  },
  "/deals": {
    title: `Deals From Verified Local Pros · ${SITE_NAME}`,
    description:
      "Current offers from license-verified local businesses across NJ, NY & PA. Every deal comes from a listed business.",
    path: "/deals",
    updated: "2026-08-27",
    crumb: "Deals",
  },
  "/guides": {
    title: `Hiring & Licensing Guides · ${SITE_NAME}`,
    description:
      "Sourced guides on licensing, permits, costs, and hiring across New Jersey, New York & Pennsylvania — every claim cited.",
    path: "/guides",
    updated: "2026-08-27",
    crumb: "Guides",
  },
  "/awards": {
    title: `Best of {County} Awards — Methodology · ${SITE_NAME}`,
    description:
      "The LicensedList Best of {County} awards are computed from verified licenses and verified-hire reviews — never sold. Full methodology, public.",
    path: "/awards",
    updated: "2026-08-27",
    crumb: "Awards",
  },
  "/founding-members": {
    title: `Founding Members — Claim Your Free Verified Listing · ${SITE_NAME}`,
    description:
      "Your license is already on our roster. Claim your free listing and get Verified free for life while founding spots in your county last.",
    path: "/founding-members",
    updated: "2026-08-27",
    crumb: "Founding members",
  },
  "/saved": {
    title: `Saved Businesses · ${SITE_NAME}`,
    description: "Your saved local pros, with their new reviews and current deals.",
    path: "/saved",
    updated: "2026-08-27",
    robots: "noindex, follow",
    crumb: "Saved",
  },
  "/account": {
    title: `My Projects · ${SITE_NAME}`,
    description: "Your quote requests as projects — the pros you contacted and where each one stands.",
    path: "/account",
    updated: "2026-08-27",
    robots: "noindex, follow",
    crumb: "My projects",
  },
  "/ai-info": {
    title: `${SITE_NAME} for AI Assistants`,
    description:
      "Structured, plain-language facts about LicensedList's license-verified directory — what the data means, how verification works, and how AI assistants can query and cite it.",
    path: "/ai-info",
    updated: "2026-08-27",
    crumb: "AI info",
  },
  "/remove-listing": {
    title: `Remove a Listing · ${SITE_NAME}`,
    description:
      "Ask us to remove an unclaimed listing of your business — honored within 2 business days, no questions, never re-added.",
    path: "/remove-listing",
    updated: "2026-08-27",
    robots: "noindex, follow",
    crumb: "Remove listing",
  },
  "/write-review": {
    title: `Write a Review · ${SITE_NAME}`,
    description:
      "Share your experience with a local business. Reviews are moderated for identity and job linkage only — never filtered by rating.",
    path: "/write-review",
    updated: "2026-08-27",
    robots: "noindex, follow",
    crumb: "Write a review",
  },
  "/search": {
    title: `Search · ${SITE_NAME}`,
    description: `Search ${SITE_NAME} for verified local businesses in New Jersey, New York & Pennsylvania.`,
    path: "/search",
    updated: "2026-08-27",
    robots: "noindex, follow",
    crumb: "Search",
  },
};

/** Paths that belong in the sitemap (indexable static routes). */
export function sitemapPaths(): { path: string; lastmod?: string }[] {
  return Object.values(ROUTE_SEO)
    .filter((seo) => !(seo.robots ?? "").includes("noindex"))
    .map((seo) => ({ path: seo.path, lastmod: seo.updated }));
}
