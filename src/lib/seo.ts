import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "./site";

/** Per-page SEO contract rendered by the site layout. */
export interface PageSeo {
  /** Full <title> text (include the brand yourself where wanted). */
  title: string;
  description: string;
  /** Path beginning with "/" — canonical is SITE_URL + this path. */
  path: string;
  robots?: string;
  ogType?: string;
  /** Real copy-change date (YYYY-MM-DD) — sitemap lastmod; bump when a static
   * page's content meaningfully changes. */
  updated?: string;
  /** Short label used for the breadcrumb trail (defaults derived from title). */
  crumb?: string;
}

/** The canonical origin. Always https — see SITE_URL in site.ts. */
export function resolveOrigin(): string {
  return SITE_URL;
}

export function organizationJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: SITE_NAME,
    url: `${origin}/`,
    slogan: SITE_TAGLINE,
    description: `${SITE_NAME} is a local business directory for New Jersey, New York, and Pennsylvania that verifies contractor and professional licenses against official state registries.`,
    areaServed: [
      { "@type": "State", name: "New Jersey" },
      { "@type": "State", name: "New York" },
      { "@type": "State", name: "Pennsylvania" },
    ],
  };
}

export function webSiteJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: SITE_NAME,
    url: `${origin}/`,
    publisher: { "@id": `${origin}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** BreadcrumbList from an ordered trail of {name, path}. Include Home first. */
export function breadcrumbJsonLd(origin: string, trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: `${origin}${crumb.path === "/" ? "/" : crumb.path}`,
    })),
  };
}

/** ItemList → ListItem → LocalBusiness (name, url) for list pages. */
export function itemListJsonLd(
  origin: string,
  items: { name: string; slug: string; schemaType?: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": item.schemaType || "LocalBusiness",
        name: item.name,
        url: `${origin}/business/${item.slug}`,
      },
    })),
  };
}

/**
 * Full LocalBusiness for profile pages. Never includes aggregateRating —
 * that's reserved for real on-site user ratings (none exist yet), never
 * editorial scores or third-party platform ratings.
 */
export function localBusinessJsonLd(
  origin: string,
  b: {
    name?: string;
    slug?: string;
    schemaType?: string;
    description?: string;
    phone?: string;
    website?: string;
    address1?: string;
    city?: string;
    state?: string;
    zip?: string;
    lat?: number;
    lng?: number;
  },
  /**
   * On-site verified review data ONLY (docs/REVIEWS.md): pass real published
   * site reviews; the block is emitted only at 3+ — never from editorial
   * scores or third-party platform numbers.
   */
  siteReviews?: { rating?: number; reviewerName?: string; body?: string; createdAt?: string }[],
) {
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": b.schemaType || "LocalBusiness",
    name: b.name,
    url: `${origin}/business/${b.slug}`,
  };
  if (b.description) node.description = b.description;
  if (b.phone) node.telephone = b.phone;
  if (b.website) node.sameAs = [b.website];
  if (b.city && b.state) {
    node.address = {
      "@type": "PostalAddress",
      ...(b.address1 ? { streetAddress: b.address1 } : {}),
      addressLocality: b.city,
      addressRegion: b.state,
      ...(b.zip ? { postalCode: b.zip } : {}),
      addressCountry: "US",
    };
  }
  if (b.lat != null && b.lng != null) {
    node.geo = { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng };
  }
  const rated = (siteReviews ?? []).filter(
    (r) => Number(r.rating) >= 1 && Number(r.rating) <= 5,
  );
  if (rated.length >= 3) {
    const avg = rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length;
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.round(avg * 10) / 10,
      reviewCount: rated.length,
      bestRating: 5,
      worstRating: 1,
    };
    node.review = rated.slice(0, 5).map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: Number(r.rating), bestRating: 5 },
      ...(r.reviewerName ? { author: { "@type": "Person", name: r.reviewerName } } : {}),
      ...(r.body ? { reviewBody: r.body } : {}),
      ...(r.createdAt ? { datePublished: r.createdAt.slice(0, 10) } : {}),
    }));
  }
  return node;
}

/**
 * Collection page + dateModified for money pages. The visible byline renders
 * the same date — Google's trust in a modified date is binary, so this is
 * stamped from real content change, never from "today".
 */
export function collectionPageJsonLd(
  origin: string,
  opts: { path: string; name: string; description: string; dateModified: string; author: string },
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${origin}${opts.path}`,
    url: `${origin}${opts.path}`,
    name: opts.name,
    description: opts.description,
    dateModified: opts.dateModified,
    author: { "@type": "Organization", name: opts.author },
    publisher: { "@type": "Organization", name: opts.author, url: origin },
  };
}

/**
 * FAQPage. Google removed the FAQ rich result on 7 May 2026, so this earns no
 * SERP real estate — it is kept because Bing and AI crawlers still parse it,
 * and it costs nothing.
 */
export function faqPageJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
