# Decisions & platform constraints log

Newest first. Every platform constraint we hit, and every product decision that wasn't
already fixed by the Phase 1 master prompt, gets an entry.

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
