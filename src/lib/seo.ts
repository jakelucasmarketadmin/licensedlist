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
