# Listing badges on businesses' own websites

A badge a listed business shows on its own site, linking to its LicensedList profile. It is
a trust signal first. The link back is a genuine citation from the business that earned the
record — never traded for a listing, never a condition of being listed.

## What exists

- `data/badges.csv` — one row per business that gets a badge (slug, name, variant,
  registry, checkedAt, website). Values come from the LIVE profile, not the import CSV.
- `scripts/listing-badge.mjs` — reads that file and writes:
  - `public/assets/badges/{slug}.svg` (+ `public/public/` copy, same as award badges),
    served at `https://www.licensedlist.com/assets/badges/{slug}.svg`
  - `docs/outreach/badges/{slug}.html` — the paste-ready snippet + schema line

```
node scripts/listing-badge.mjs                 # all rows
node scripts/listing-badge.mjs --slug armstrong-roofing
```

## Variants

| variant | shows | use for |
| --- | --- | --- |
| `verified` | green shield, "License verified · {Mon YYYY}", registry name | listings whose live badge is "License verified" |
| `listed` | neutral shield, "Listed on LicensedList" | "License not required", "Credential on file", or anything not yet verified |

The script refuses a `verified` badge with no registry/date or a check older than 365 days —
the same freshness rule `TrustBadge.astro` applies on the site. A business never gets a
green badge on its own site that the profile itself wouldn't show.

## Link rules (do not change without reading this)

- Plain `<a><img>` HTML only. No JavaScript widget, no iframe.
- Anchor is the image; alt text is branded ("License verified on LicensedList …"). Never a
  keyword anchor ("best plumber Westwood NJ") — keyword badge links are named in Google's
  link-spam policy.
- Link target is the business's profile page, never the LicensedList homepage.
- One to two placements per site (trust/reviews section + About or Contact). Not a sitewide
  footer: no extra value, louder pattern.
- On agency-client sites the badge must sit in server-rendered HTML. Some client sites
  render their body client-side only (e.g. Hofmeister's `client:only` SPA) — there the
  link is invisible to non-JS crawlers, so place it in a server-rendered section or the
  `<noscript>` stub as well.
- Our side is already correct: every outbound "Website" link on a profile is `nofollow`,
  and `sponsored nofollow` on paid/client placements (`BusinessProfileView.astro`,
  `ResultCard.astro`). Profile JSON-LD already carries `sameAs: [website]`.

## Install on a business's site (VA checklist)

- Open `docs/outreach/badges/{slug}.html`.
- Paste part 1 (the `<a><img>`) into the site's trust/reviews section.
- Paste it again on the About or Contact page.
- Add the profile URL from part 2 to the `sameAs` array of the site's existing
  LocalBusiness/Organization JSON-LD (create the array if missing; keep existing entries).
- Publish the site.
- View the live page source (not the rendered DOM) and confirm the `<a href=".../business/{slug}">` is in it.
- Click the badge and confirm it opens the right profile.
- Run the page through Google's Rich Results Test and confirm `sameAs` includes the profile URL.

## Keeping badges honest

- After every `verify-licenses` pass (monthly `--stale 180`), update `checkedAt` in
  `data/badges.csv` for re-checked rows and re-run the script. Same URL, so installed
  snippets update themselves.
- If a license lapses or a listing drops to credential-only, flip its row to `listed`
  (or remove the row and delete the SVG) the same day.

## Status (2026-10-16)

- Generated: hofmeister-plumbing, daylight-design, armstrong-roofing, the-body-serene,
  dryden-dispensary, pascale-electric (verified); ilm-aesthetics, eta-bootcamp,
  riccardi-media (listed).
- ilm-aesthetics is `listed`, not `verified`, on purpose: its live profile shows
  "License verified" on MD060356L, which is the medical director's personal physician
  license. Under VERIFICATION.md that is a credential, so the profile should be
  `credential-only` until a facility record is found. Fix the CMS row, then decide.
- Not generated (not current clients or no website): faustinis-martial-arts,
  hanah-mountain-resort, miraglia-contractors.
- Next: offer the `listed`/`verified` badge to unclaimed verified businesses through the
  claim flow — that is where independent referring domains come from.

## Installed on agency-client sites (2026-10-16)

All on `/` and the About page, plus a server-rendered copy (noscript / SEO-fallback block)
because every client site mounts its body `client:only`. Profile URL added to each site's
main business JSON-LD `sameAs`.

| Site repo | Listing | Commit |
| --- | --- | --- |
| plumb-air | hofmeister-plumbing | 14ab027 |
| dispensary | dryden-dispensary | f31bbeb |
| Tier201/arsmtrong-roofing-llc | armstrong-roofing | 9d33cb9 |
| sky-vista | daylight-design | c1dd3be |
| med | the-body-serene | 5bffa34 |
| pascale-electric | pascale-electric | 1627b04 |
| ilm-aesthetic | ilm-aesthetics (listed) | 41def55 |
| electrc-camp | eta-bootcamp (listed) | ddececc |
| riccardi-media | riccardi-media (listed) | 7c3c3dc |

ETA: `src/lib/seo-data.ts` is generated by extract-seo.py from eta-site/ — re-add the
sameAs there if that script is ever re-run.
