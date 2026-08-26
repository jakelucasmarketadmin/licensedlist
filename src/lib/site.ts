/**
 * Single source of truth for site identity.
 *
 * SITE_NAME is a working brand name — never hardcode it in copy, titles, or
 * components. Import it from here so the brand can be swapped in one place.
 */
export const SITE_NAME = "TriVetted";
export const SITE_TAGLINE = "Vetted across NJ, NY & PA";

/**
 * Canonical origin (https, no trailing slash) — the single source for
 * canonical URLs, og:url, JSON-LD ids, and the sitemap. Set PUBLIC_SITE_URL
 * in the environment when the custom domain is connected; the fallback is the
 * current Wix-hosted domain. Never derive canonicals from the request origin:
 * behind Wix's proxy, Astro.url reports an internal http:// scheme.
 */
export const SITE_URL: string =
  import.meta.env.PUBLIC_SITE_URL ?? "https://my-site-nf00gfth-tier201.wix-vibe-site.com";

/**
 * The real business showcased on the home hero, /how-we-verify, and
 * /for-businesses. Falls back to the sample specimen card when this record
 * isn't published — safe to rotate anytime.
 */
export const SHOWCASE_BUSINESS_SLUG = "hofmeister-plumbing";

/** Contact for business onboarding until the claim flow ships (M4). */
export const BUSINESS_CONTACT_EMAIL = "admin@tier201.com";

/** Where "Report" links on reviews and Q&A deliver (docs/REVIEWS.md moderation). */
export const REVIEW_REPORT_EMAIL = "admin@tier201.com";

export const STATES = [
  {
    name: "New Jersey",
    abbr: "NJ",
    slug: "nj",
    launchCounties: [
      "Bergen",
      "Essex",
      "Middlesex",
      "Hudson",
      "Monmouth",
      "Ocean",
      "Union",
      "Morris",
    ],
    licenseNote:
      "Home-improvement contractors register with the NJ Division of Consumer Affairs; many trades carry state license numbers you can look up.",
  },
  {
    name: "New York",
    abbr: "NY",
    slug: "ny",
    launchCounties: [
      "Kings (Brooklyn)",
      "Queens",
      "New York (Manhattan)",
      "Bronx",
      "Richmond (Staten Island)",
      "Nassau",
      "Suffolk",
      "Westchester",
      "Rockland",
    ],
    licenseNote:
      "In NYC, home-improvement contractors are licensed by the Dept. of Consumer and Worker Protection; suburban counties run their own licensing offices.",
  },
  {
    name: "Pennsylvania",
    abbr: "PA",
    slug: "pa",
    launchCounties: ["Montgomery", "Bucks", "Delaware", "Chester", "Philadelphia"],
    licenseNote:
      "Contractors register with the PA Attorney General under HICPA; licensed professions are verifiable in the state PALS system.",
  },
] as const;

/**
 * Starter categories for the hero search suggestions and the home grid.
 * Replaced by the Categories CMS collection in Phase 1 M2 — keep this list
 * small and generic until then.
 */
export const STARTER_CATEGORIES = [
  "Roofers",
  "Plumbers",
  "Electricians",
  "HVAC contractors",
  "Landscapers",
  "House cleaners",
  "Painters",
  "General contractors",
  "Auto repair shops",
  "Dentists",
  "Chiropractors",
  "Attorneys",
  "Accountants",
  "Salons & barbers",
  "Pest control",
  "Movers",
  "Locksmiths",
  "Tree services",
  "Junk removal",
  "Real estate agents",
  "Insurance agents",
  "Physical therapists",
  "Veterinarians",
  "Restaurants",
] as const;

/**
 * Starter "Where" suggestions (launch-area towns). Replaced by the Towns CMS
 * collection in M2.
 */
export const STARTER_TOWNS = [
  "Hackensack, NJ",
  "Newark, NJ",
  "Jersey City, NJ",
  "Edison, NJ",
  "New Brunswick, NJ",
  "Hoboken, NJ",
  "Freehold, NJ",
  "Toms River, NJ",
  "Elizabeth, NJ",
  "Morristown, NJ",
  "Paramus, NJ",
  "Montclair, NJ",
  "Brooklyn, NY",
  "Queens, NY",
  "Manhattan, NY",
  "Bronx, NY",
  "Staten Island, NY",
  "Hempstead, NY",
  "Huntington, NY",
  "Yonkers, NY",
  "White Plains, NY",
  "New Rochelle, NY",
  "New City, NY",
  "Norristown, PA",
  "King of Prussia, PA",
  "Doylestown, PA",
  "Media, PA",
  "West Chester, PA",
  "Philadelphia, PA",
  "Lower Merion Township, PA",
] as const;
