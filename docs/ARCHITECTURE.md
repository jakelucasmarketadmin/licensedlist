# Architecture

_Phase 1 · Tri-state local business directory on Wix Vibe. Working brand: see `SITE_NAME` in
`src/lib/site.ts` — never hardcode the name._

## What Vibe generated

A Wix-managed Headless project: Astro 5 (`output: "server"`, Wix cloud adapter) + React 18 +
Tailwind 3.4 + shadcn/Radix UI, with Wix CMS as the database (`src/entities/`), Wix auth/members
integration (`src/integrations/`), and a single catch-all route at `src/pages/[...slug].astro`.
As generated, the catch-all rendered an empty shell and a client-only React Router SPA
(`src/components/Router.tsx`) — no crawlable HTML.

Deploys: commits to `main` sync to the Wix Vibe app; `wix release` publishes to the live site.
**This repo cannot be built or type-checked locally** — it depends on Wix's private npm registry.
See DECISIONS.md for how we verify changes before pushing.

## What we changed (M1)

Pages are now **fully server-rendered Astro views** — no client-side router, no client-only
content. This is the project's core SEO requirement: every decision-critical fact must be in
the initial HTML.

```
src/pages/[...slug].astro   Single entry. Route allow-list → view + per-page SEO.
                            Unknown path = real 404 (status + noindex). Trailing
                            slashes normalize to the no-slash canonical.
src/layouts/SiteLayout.astro  <html> shell: full SEO head (title, description,
                            canonical, robots, OG/Twitter, JSON-LD slot), fonts,
                            skip link, Header, <main>, Footer.
src/views/*.astro           One view per page, content-only (no <html>/<head>).
src/components/site/*.astro Shared site components (Header, Footer, Wordmark,
                            HeroSearch, VerifySpecimen).
src/lib/site.ts             SITE_NAME, tagline, states/launch counties, starter
                            category & town lists (replaced by CMS in M2).
src/lib/seo.ts              PageSeo type, canonical-origin resolution, JSON-LD
                            builders (Organization, WebSite+SearchAction).
src/styles/global.css       Design tokens (CSS variables, light + dark via
                            prefers-color-scheme), base styles, ledger motif.
src/tailwind.config.mjs     Maps Tailwind colors/fonts to the CSS tokens.
```

### Design system

- Type: Inter (UI/body) · Bricolage Grotesque (display, H1s/section headings) ·
  IBM Plex Mono (the "verification record" ledger motif). Loaded via Google Fonts `<link>`
  in the layout — **not** `fonts.css` (see DECISIONS.md).
- Color: deep navy primary + one warm ember accent (CTAs only) + semantic
  green/amber/red for license states. All values live once in `global.css`;
  components use Tailwind classes backed by the tokens (`bg-paper`, `text-ink`,
  `bg-accent`…). Note: Tailwind opacity modifiers (`bg-surface/50`) do NOT work
  on var()-backed colors — don't use them.
- Signature element: the "verification record" — a mono ledger block naming the
  registry source and check date. `VerifySpecimen.astro` is the sample shown on
  the home hero; the same motif will render real records on business profiles (M3).

### Routing rules

New pages = add a view in `src/views/` + one entry in the `routes` table in
`[...slug].astro` (path, view, title, description, robots). Item pages (M2/M3) will move to
data-driven resolution in the same file and export `wixMetadata` per Wix's item-SEO doc.

### Legacy template files

`src/components/Router.tsx`, `src/components/pages/HomePage.tsx`, `src/components/Head.tsx`,
and the shadcn kit in `src/components/ui/` are no longer referenced by any page but are left
in place for M1 (the ui kit will be reused for interactive islands in M3/M4). Do not delete
`@wix/*` packages.
