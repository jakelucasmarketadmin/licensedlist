# QA Report

Living document — a section per milestone. Final full pass lands with M5.

## M1 + review fixes (verified live 2026-08-24)

Base URL: https://my-site-nf00gfth-tier201.wix-vibe-site.com

**Review-fix verification (all confirmed against the live site with curl):**

| Item | Result |
| --- | --- |
| Canonicals + og:url | `https://`, built from `SITE_URL`; verified on every route |
| JSON-LD | `WebSite` (SearchAction → `/search?q={search_term_string}`) + `Organization` on home; `BreadcrumbList` on every non-home page |
| Sitemap | Wix's platform 404s `*.xml` routes, so `/sitemap.xml` can't be served (fleet-wide behavior); the same XML serves at **`/sitemap`** (200) and robots.txt now points there (dashboard Robots.txt Editor) |
| Business CTA | `/for-businesses/get-listed` form → `claims` collection (permissions: collect-content) + optional `PUBLIC_GHL_CLAIM_WEBHOOK`; email demoted to secondary line |
| Bylines | On `/how-we-verify` + `/editorial-policy` with AI-assist disclosure |
| Light theme | Was already light-by-default (`:root` = light, dark only under `prefers-color-scheme: dark`) — the review was made in a dark-mode browser. Both themes screenshot-verified. |
| County chips | Plain text in M1, links since M2 |
| Specimen card | Name contains "Sample", labeled "sample record", never emitted as JSON-LD |

**Mobile pass (390px, live site, light scheme — screenshots in `docs/screens/`):**
`m1-mobile-home.png`, `m1-mobile-how-we-verify.png`, `m1-mobile-for-businesses.png`

- No horizontal scroll: `document.scrollWidth === 390` measured on every captured page (also verified at 320px in the pre-push harness).
- Nav collapses to a disclosure menu (CSS-only `<details>`) with the "List your business" CTA still visible in the bar and a "Get listed free" CTA inside the menu.
- Hero search stacks What / Where / Search vertically; button is 48px tall.
- Chips ≥40px tall targets; nav/CTA buttons ≥36px; all interactive targets ≥24px.

## M2 — Geography + taxonomy (verified live 2026-08-24)

**Live URLs:** `/nj` · `/ny` · `/pa` · `/nj/bergen-county` · `/nj/bergen-county/hackensack` ·
`/pa/montgomery-county` (+ 22 counties / 87 towns total) — all 200; invalid geo slugs 404.

- Collections created + seeded via the CMS dashboard CSV importer (IDs: `states` 3,
  `counties` 22, `towns` 87, `categorygroups` 8, `categories` 62, `claims` 0/form-ready).
  Same CSVs feed the generated TS modules the hub pages render from.
- 3-listing publishing rule: hubs render geography + guides and an explicit category
  empty-state ("Listings coming soon in {scope} … Get listed free") — no fake counts.
- Sitemap: 120 URLs (8 static + 3 states + 22 counties + 87 towns); robots.txt points at `/sitemap`.
- Breadcrumbs (visible + JSON-LD) on every hub; titles follow
  "Local Businesses in {Town}, {ST}" patterns; descriptions from geo intros.
- Screenshots: `m2-desktop-*.png`, `m2-mobile-*.png` in `docs/screens/` (live captures,
  light scheme, no horizontal overflow at 390).
