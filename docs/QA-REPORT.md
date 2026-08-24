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

## M3 — Listings engine (verified live 2026-08-24)

- **Server-side CMS reads confirmed in production** (listings/profiles render from the
  `businesses` collection in the initial HTML — no client-side data fetching for content).
- **3-listing publishing rule enforced:** every public geo×category page and draft profile
  returns a real 404 (`/nj/bergen-county/hackensack/roofers` → 404,
  `/business/sample-roofing-co` → 404). `?preview=demo` renders the labeled DEMO drafts with
  a banner and forced noindex (`m3-desktop-money-page-preview.png`).
- Money-page checks: "Updated August 2026" in H1/title, methodology line + funnel counts
  ("N listed · M license-verified"), labeled Featured block, transparent-ranking section,
  license-ledger on every card, guide + visible FAQ, qualified nearby/related links.
- `rel="sponsored"` on all featured/sponsor/client links (4 instances on the sample page,
  covering the featured block and the sponsored organic card).
- JSON-LD: `ItemList` on list pages (published records only), `LocalBusiness` +
  `BreadcrumbList` on profiles, **no aggregateRating anywhere** (reserved for real on-site
  user ratings).

## M4 — Conversion (verified live 2026-08-24)

- **Lead pipeline tested end-to-end on the live site:** a test quote request submitted through
  the profile form appeared in the `leads` collection with business/category/town context,
  message, urgency, consent text and timestamp — then was deleted. Claims flow smoke-tested
  the same way earlier.
- Consent: checkbox with explicit named disclosure (providers may call/text; consent not a
  condition of purchase); the exact text shown is stored on the record. `consentIp` is not
  captured client-side (see DECISIONS.md).
- `leads` and `claims` use the "Collect content" permission (anyone submits, admins read).
- `/pricing` live with the always-labeled/never-ranks copy; `/claim` → `/claim/{slug}` flow
  live (noindex on per-business claim pages).

## M5 — Final QA (2026-08-24)

**Lighthouse (mobile emulation, live site):**

| Page | Perf | A11y | Best practices | SEO | LCP | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| Home | 99 | 92 | 100 | 100 | 1.7s | 0 |
| State hub /nj | 99 | 91 | 100 | 100 | 1.9s | 0 |
| Town hub | 99 | 90 | 100 | 100 | 1.9s | 0 |
| Category hub /roofers | 99 | 91 | 100 | 100 | 1.9s | 0.019 |
| /how-we-verify | 99 | 91 | 100 | 100 | 1.9s | 0.014 |
| Money page (preview) | 99 | 92 | 100 | 63* | 1.9s | 0.025 |
| Profile (preview) | 99 | 92 | 100 | 63* | 1.9s | 0 |

\* Preview pages are deliberately noindex — that's the entire SEO deduction.
Targets (≥90 hubs) exceeded everywhere; zero blocking time; no map JS shipped.

**Accessibility:** the one real finding — dark-mode accent buttons at 3.54:1 — was fixed
(dark accent now #c2500a, ≥4.5:1; light was already 4.79:1). The only remaining flag on any
audited page is the target-size of **Wix's own** "Built on WIX Vibe" banner close button,
which is injected by the platform on the free domain and not controllable from the repo.

**Link integrity:** full-site crawl (all 186 reachable pages): **0 broken internal links.**
The crawl initially caught 1,364 category-hub → county×category links pointing at
sub-threshold 404s; all internal linking is now qualification-aware (links to geo×category
pages render only when the target meets the 3-listing rule).

**Compliance spot-checks (live):** every list page carries the methodology line + "How we
verify" links + "Updated {Month YYYY}"; sub-threshold pages 404; sponsored placements
labeled visually and with `rel="sponsored"`; specimen/DEMO records marked "Sample"
everywhere they render.

## Phase 2 (verified live 2026-08-24)

**Corrections re-verified live:** featured businesses render once (Featured block only, fixed
note under it — screenshot `p2a-featured-dedupe-live.png`); county hubs link to the
methodology instead of repeating it; Owner FAQ single-sourced on /for-businesses + /pricing;
profile shows one client disclosure (in the verification card, chip in header) and expands
service towns to names ("Serves Teaneck and Hackensack").

**Live checks by section:**
- P2-A: importer validated (template row correctly rejects on unseeded slug; publish/draft
  rule and reports verified); awaiting the client CSV.
- P2-B: NYC bulk match ran against the live dataset (21,548 DCWP HIC records); demo NYC
  record correctly routed to manual review; NJ/PA rows routed to their manual checklists;
  amber "Verification due" badge >365d and the PA AG caveat are in the template.
- P2-C: GA4 loads only when `PUBLIC_GA4_ID` is set (verified absent by default); footer
  Privacy-choices link + /privacy#analytics live; SEARCH-CONSOLE.md ready for the domain.
- P2-D: `/api/webhook-forward` live (no URLs configured yet — logs and continues);
  `/api/owner-listing` correctly 401s anonymous callers; `/owner` renders the sign-in flow.
  Full member E2E pending a real owner signup (see DECISIONS).
- P2-E: `/api/featured-slots` returns `{cap:3, taken:0, open:3}` for live scopes; request/
  waitlist flow on /pricing; featuredUntil expiry enforced in templates; plan terms in /terms.
- P2-F: all 49 guides render live on their hubs with bylines, dates, official sources, and
  the AI-assist disclosure; /for-businesses/why-verified live; outreach targets CSV generates
  (264 slots, 0 live pre-import).

**Lighthouse (mobile, live):** home 94 · state hub 99 · county hub (guide-heavy) 92 ·
category hub 99 · pricing 99 · why-verified 99 — all ≥90 target; best-practices 100 and
SEO 100 everywhere; a11y 95–96 (dark-accent fix confirmed; remaining flags are the
Wix-injected free-domain banner).

**Crawl:** 186/186 reachable pages, **0 broken internal links** after the Phase 2 content
drop. New indexable URLs added by Phase 2: 1 (`/for-businesses/why-verified`) — see
PUBLISH-LOG.md.
