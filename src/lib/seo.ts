import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "./site";

/** Per-page SEO contract rendered by the site layout. */
export interface PageSeo {
  /** Full <title> text (include the brand yourself where wanted). */
  title: string;
  description: string;
  /** Path beginning with "/" — canonical is origin + this path. */
  path: string;
  robots?: string;
  ogType?: string;
}

/** Resolve the canonical origin: pinned SITE_URL once a domain exists, else the request origin. */
export function resolveOrigin(requestOrigin: string): string {
  return SITE_URL ?? requestOrigin;
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
        urlTemplate: `${origin}/search?what={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
