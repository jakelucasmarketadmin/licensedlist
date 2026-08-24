# Decisions & platform constraints log

Newest first. Every platform constraint we hit, and every product decision that wasn't
already fixed by the Phase 1 master prompt, gets an entry.

## 2026-08-24 · M2–M4 build

**Publish flow (operational).** GitHub pushes sync into the Vibe editor automatically but do
NOT go live on their own — someone must press Publish in the Vibe editor
(vibe.wix.com/projects/{siteId}/v/editor). The `wix` CLI on this machine is not logged in, so
`wix release` is unavailable until the owner runs `wix login`. Every milestone in this phase
was published through the editor.

**`/_wix/pages.json` + `wixMetadata` don't apply to custom CMS routes.** Wix's item-page SEO
registration (per their "Add SEO support to item pages" doc) only covers Wix business-app
pages (Stores/Blog/Bookings/Events) whose identifiers come from `WIX_APPS`. Our directory
routes are custom, so the auto-generated sitemap can't include them. Consequence: we serve our
own sitemap. `*.xml` routes 404 at the Wix platform layer (fleet-wide behavior), so the
sitemap serves at **`/sitemap`** and the dashboard Robots.txt Editor points there.

**Collections created via dashboard CSV import; collection IDs are immutable.** The
create-collection dialog's "Import from CSV" path auto-names collections ("Import 1" — the
origin of the fleet's `Import5`-style IDs). The working recipe: Create Collection → Start
from scratch → set BOTH name and the collection ID field → then "Import CSV file" inside the
empty collection, which creates fields from the CSV headers. IDs in use: `states`, `counties`,
`towns`, `categorygroups`, `categories`, `claims`, `leads`, plus the Vibe-era `businesses`.

**CSV import field-type inference needs review.** The importer inferred `towns.localFacts`
(a JSON-array string) as a **Reference → Businesses (multiple items)** field and silently
deselected it; it was manually re-typed to Text during the import. Numbers/booleans inferred
fine. `categories.licenseSourcesByState` imported as text with warnings (content intact).

**Geo/taxonomy render from generated modules; CMS is the mirror.** `data/**.csv` is the single
source of truth: `scripts/generate-data-modules.mjs` emits `src/data/*.generated.ts` (what hub
pages render from — fast, no per-request CMS reads for static reference data), and the same
CSVs were imported into the CMS collections (master-prompt schema, available to Wix tooling
and the importer scripts). Re-run the generator + re-import whenever the CSVs change.

**Server-side CMS reads work on Wix.** Verified in production via a temporary probe:
`BaseCrudService.getAll` executes in Astro frontmatter on the deployed site (the Vibe demo
`businesses` collection returned its items). Listings/profiles are fully server-rendered from
CMS — the SEO-critical requirement. A 60s in-process cache keeps hub/list pages cheap.

**Businesses collection strategy.** The master prompt says never delete collections, so the
Vibe-era `businesses` collection (12 unrelated demo rows without `status`/`slug`) was kept and
the new schema's fields were added by importing the 10 DEMO records
(`data/import/businesses-demo.csv`). Every query filters on records that have `slug`+`status`,
so the legacy rows are invisible. The 10 DEMO records are `status=draft`,
`sourceNotes=DEMO`, names like "Sample Roofing Co.", and render only in preview mode.

**Preview mode.** `?preview=demo` renders draft+DEMO records on list/profile/claim pages with
a visible banner and forced `noindex` — this is how M3 "draft businesses used for preview
only" is satisfied without ever publishing invented facts. Public pages enforce the 3-listing
rule with real 404s.

**Filters are server-side query params, robots-blocked.** `?filter=verified|responds-24h|
rating-45` re-renders the organic list filtered and sets `noindex, follow` (canonical stays
on the unfiltered page), matching the master prompt's "robots-blocked query params" option.
No client-side filter JS shipped yet; map/compare-tray remain deliberately unshipped (no map
JS until a map exists to toggle).

**Leads/claims consent.** The quote form stores the exact consent text shown, timestamp, and
user agent. **consentIp is not captured** — the browser can't see its own IP and there's no
server endpoint for form ingest yet; capturing it needs a server route or Wix Automations
enrichment. Logged as an M-next item; the field exists in the collection.

**Wix Members claim-login deferred (Phase 2).** Master prompt §8 pairs Members/Pricing Plans
with Phase 2. The M4 claim flow verifies ownership out-of-band (call the number on file /
email the business domain / document) and records claims in the `claims` collection.
`leads`/`claims` collections use the "Collect content" permission preset (anyone can submit,
only admins read).

**GHL webhooks are stubs.** `PUBLIC_GHL_LEAD_WEBHOOK` / `PUBLIC_GHL_CLAIM_WEBHOOK` fire from
the client when set (they are PUBLIC_ because there's no server ingest route; the CMS record
is the source of truth and the webhook is best-effort). When real GHL URLs exist, wire Wix
Automations (CMS item created → Send HTTP Request) instead and drop the client stubs —
that path keeps URLs private and adds retries.

**Reviews & Guides collections not yet created.** Nothing writes or reads them yet (on-site
reviews and editorial guides are post-Phase-1 content work). Create via the same recipe when
needed.

## 2026-08-24 · M1 foundation

**No local build — verified via a shadow harness instead.** `npm install` fails in this repo
(Wix private npm registry, e.g. `@wix/astro`), so `npm run build` / `astro check` cannot run
locally; the real build runs on Wix's side at deploy. Mitigation: a scratchpad "shadow
harness" — a minimal public-npm Astro project (astro + @astrojs/tailwind) that symlinks
nothing from Wix: it copies `src/{views,layouts,lib,styles,components/site}` plus the
tailwind config, and strips only the two `@wix/wix-vibe-plugins` CSS imports from the
catch-all. Every M1 page was rendered, status-checked (200/404/robots), and visually
reviewed in light+dark at 320/375/1280 before pushing. Re-create it any time with the same
recipe; keep repo views free of `@wix` imports where possible so they stay harness-renderable.

**Dropped the client-only SPA rendering path (master prompt §1 “keep everything
server-rendered” wins over the generated template).** The Vibe-generated `[...slug].astro`
rendered `<AppRouter client:only="react">` — zero crawlable HTML. Pages are now pure Astro
SSR views. Consequence: the Vibe visual editor's click-to-edit may degrade on these pages;
we drive the site from this repo per the project brief. The generated demo files
(`Router.tsx`, `pages/HomePage.tsx`) are unreferenced but not deleted yet.

**Dropped `@wix/seo` `<SEO.Tags>` from the head.** We render title/description/canonical/
robots/OG/JSON-LD ourselves per master prompt §1 (don't rely on the Wix SEO dashboard).
Precedent: the electrc-camp production site ships without `SEO.Tags` with no ill effect.

**`fonts.css` neutralized.** The generated file self-hosts Open Sans with `src` URLs under
`/public/fonts/...`, which 404 in production (`public/` is served at the root) — the same
bug previously found on the southjunk site. Fonts (Inter, Bricolage Grotesque, IBM Plex
Mono) now load via Google Fonts `<link>` in `SiteLayout.astro`. If Wix tooling regenerates
`fonts.css`, re-stub it.

**Canonical origin is request-derived for now.** No custom domain exists yet, so
`SITE_URL` in `src/lib/site.ts` is `null` and canonicals/JSON-LD use the request origin.
When the production domain is chosen, set `SITE_URL` once — the rule from the electrc-camp
canonical incident applies: the canonical host must be whatever returns 200, and must move
if the Wix primary domain ever flips.

**M1 scope additions.** Shipped `/about`, `/editorial-policy`, `/privacy`, `/terms`, and a
noindex `/search` zero-state beyond the three M1 pages, so the footer and hero search have
no dead ends. State hubs, `/categories`, `/claim`, `/pricing` are deliberately absent —
they 404 until their milestones (no thin placeholder pages, per the 3-listing rule's
spirit). Home links to categories via `/search?what=…` until category pages exist.

**Business onboarding CTA is a mailto.** The claim flow is M4; until then `/for-businesses`
CTAs email `BUSINESS_CONTACT_EMAIL` (currently `admin@tier201.com` — the agency address on
file). **Owner: confirm this address or give a directory-branded one.**

**Legal pages are working drafts.** `/privacy` and `/terms` are honest, directory-specific
drafts written for launch posture (consent-logged lead sharing, no data sales, no
third-party ad trackers). Have counsel review before real leads flow (M4).

**Demo/specimen data is labeled.** The only "business" on the site is the hero's
`VerifySpecimen` card — fictional, marked "Sample … record" in copy, per the no-invented-
facts rule.
