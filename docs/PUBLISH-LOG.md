# Publish log — new-URL batches (throttle: ≤50 URLs/week)

Guides render as sections on existing hub pages (state/county/category), so the Phase 2
content drop adds **zero new URLs** — enriched pages only. New URLs appear when list pages
cross the 3-listing threshold or business profiles publish; log each batch here.

| Date | Batch | New URLs | Notes |
| --- | --- | --- | --- |
| 2026-08-24 | Phase 2 content drop | +2 | `/for-businesses/why-verified`, `/owner` (noindex). 49 guides shipped as sections on existing hubs — no new indexable list URLs. |

**Smoke 2026-08-24 22:10 UTC:** PASS — all 9 routes 200

**Smoke 2026-08-24 23:31 UTC:** PASS — all 9 routes 200

**Smoke 2026-08-25 00:26 UTC:** PASS — all 9 routes 200

**Smoke 2026-08-25 00:31 UTC:** PASS — all 9 routes 200

**Smoke 2026-08-25 03:03 UTC:** PASS — all 9 routes 200

**Smoke 2026-08-25 16:39 UTC:** PASS — all 9 routes 200

**Smoke 2026-08-25 16:48 UTC:** PASS — all 9 routes 200

**Smoke 2026-08-26 20:30 UTC:** PASS — all 9 routes 200

**Smoke 2026-08-26 21:16 UTC:** PASS — all 11 routes 200
  - Batch B publish: Profile 2.0, on-site review system (reviews/servicePrices/questions
    collections), Q&A, /write-review (noindex — NO new indexable URL types). Crawl: 284
    pages, 0 broken. JSON-LD: aggregateRating correctly suppressed at <3 on-site reviews.

**Smoke 2026-08-26 22:03 UTC:** PASS — all 11 routes 200
  - B-fixes publish: map static-fallback layer + WebGL detection, /v1/fill transforms on all
    wixstatic media (403 root cause = missing h + extension-less filename), 26/26 photos
    mirrored to our media namespace, LQIP + eager LCP images + preload (Lighthouse mobile
    warm: profile 96 LCP 2.7s / demo profile 97 LCP 2.4s / list 90 / home 92), unclipped
    list cards, project-card grid, curated heroEligible hero pool.

**Smoke 2026-08-26 22:36 UTC:** PASS — all 16 routes 200

**Smoke 2026-08-26 22:46 UTC:** PASS — all 16 routes 200
  - C0 + Batch C publish: 5 new indexable URLs (/events /deals /guides /awards
    /founding-members — within the 50/week budget; registered rows add ZERO URLs).
    Registry live: 10,083 registered rows (NYC HIC w7w3-xahh all five boroughs 9,584 +
    Richmond RE offices 499; the acd4-wkax mislabel was purged same-day). Crawl 288 pages
    0 broken. New collections: events, offers, awards, subscribers (+DEMO rows behind
    preview).

**Smoke 2026-08-27 00:47 UTC:** PASS — all 19 routes 200
  - R-fixes + Batch D publish: registry cleanup (4 junk rows removed, 3,259 names
    normalized → data/registry-rejects.csv), table v2 (category/address/search + shared
    license-cycle note, verified 13,383/13,385 share 2027-02-28), founding counters
    rewritten + pending counties. Batch D: NL intake (+intentLogs, no raw text), saved
    lists + my projects (noindex /saved /account), AI review summaries + concierge
    (both ANTHROPIC_API_KEY-gated, clean degradation verified live), /ai-info (1 new
    indexable URL) + llms.txt + /api/data/{listings,guides}.json. Smoke 19/19, crawl
    290 pages 0 broken.

**Smoke 2026-08-27 01:42 UTC:** PASS — all 19 routes 200
  - D-fixes + Batch E + launch pass: address formatting, honest counts (11 vetted /
    7 license-verified — no drift, 4 published are not-required categories), hero
    search/describe tabs, curated hero pool (6 buildings-prominent), events/deals/awards
    out of primary nav. Batch E: first-party metrics + /api/track, owner-stats
    (benchmark/completeness/AI-visibility), posts + owner offers, weekly digest endpoint.
    Launch: 36/36 checks (docs/LAUNCH-CHECKLIST.md), lastmod 289/289 real dates,
    Lighthouse all 15 templates ≥85 perf / ≥95 a11y, crawl 290/0. END OF BUILD PHASE.

**Smoke 2026-08-27 01:52 UTC:** PASS — all 19 routes 200

**Unclaimed batch 1, tranche 1 — 2026-08-27:** 13 public-records businesses imported
  (all 13 licenses verified against their registries same day — NJ MyLicense person +
  business search, PA AG HICPA, PA PALS; zero failures, needs-verification.csv empty).
  Corrections found during verification: great-american 13VH04492500 (site) is the
  Active one, BBB's 13VH06616100 is an expired dba of another entity; grounded-electric
  "16590" resolved to Active business permit 34EB01659000; C&C's garbled NJ number
  resolved to 13VH04508000; sanctuary-spa has no facility license — owner Joanna
  ("Asia") I. Sigda's individual esthetician license CQ117677 (Active, exp 1/31/2027)
  recorded instead. Published now (tranche 1): hodges-and-sons-plumbing,
  breitenbach-plumbing, homestead-roofing, great-american-roofing + daylight-design
  (client draft, HIC 13VH01553100 verified 8/27 → published to complete the Bergen
  roofers threshold). Remaining 9 imported as draft, photos mirrored (36 files → own
  wixstatic namespace 1f5d89).
  New indexable URLs: 54 — town×category pages 46 (Bergen plumbers 17, Bergen
  hvac-contractors 17 [Hodges+Breitenbach carry Active 19HC HVACR licenses, joining
  Hofmeister], Bergen roofers 12), county pages 3, profiles 5. 4 over the nominal
  50/week — flagged, driven by the unplanned hvac-contractors threshold crossing.
  Tranche 2 (~9/3): Bergen electricians + Montgomery spas. Tranche 3 (~9/10):
  Montgomery + Middlesex roofers. Sitemap fix: county×category pages now emitted
  (same >=3 rule as the route).

**Smoke 2026-08-27 04:24 UTC:** PASS — all 19 routes 200

**Smoke 2026-08-27 04:30 UTC:** PASS — all 19 routes 200

**Sanctuary reframing + notice approval — 2026-08-27:** Sanctuary Spa moved off the
  verified badge. PA PALS holds no facility license at 105 Mattison Ave (checked all
  boards by street statewide, and every cosmetology facility in Ambler), so the business
  is now `licenseStatus = credential-only` — neutral "Credential on file" badge — with the
  owner's individual esthetician license (Joanna I. Sigda, CQ117677, active to 2027-01-31)
  recorded as a credential in the Verification block, stating plainly that no facility
  license is on file. New rule in docs/VERIFICATION.md: an individual practitioner
  credential is displayed as a credential, never as a business license, and never earns the
  badge. InBalance (CZ123155) and Pure Spa (CZ116612) are Esthetician **Salon** licenses —
  facility licenses matching the listed addresses — and keep the badge. Every batch-1
  `licenseHolder` rewritten as prose (the ILM/Pascale convention), incl. daylight-design:
  "Registered with NJ DCA as Homeworks by Joseph Ottomanelli." Importer gained an optional
  `licenseStatus` override column so re-imports can't demote credential-only rows.
  Tranche-1 overage (54 vs 50) accepted per Lucas; tranche 2 measured at 21 new URLs, well
  under the 40 ceiling set to compensate. Notice email copy approved with edits (fact
  first, plain-text profile + removal URLs, no opt-in-implying subject); send capped at 5
  per batch, a day apart — BLOCKED on env: REVIEW_CRON_SECRET and GHL_NOTICE_WEBHOOK are
  both unset on the live site.

**Smoke 2026-08-27 05:39 UTC:** PASS — all 19 routes 200

**Smoke 2026-09-03 00:40 UTC:** PASS — all 19 routes 200

**Unclaimed batch 1, tranche 2 — 2026-08-27 (released early at Lucas's instruction):**
  Status flipped draft→published on grounded-electric, academy-electrical,
  sanctuary-spa-ambler, inbalance-wellness-spa, pure-spa-ambler. **21 new indexable URLs**
  — exactly the projection, and inside the 40 ceiling set to compensate for tranche 1's
  overage. Sitemap 343 → 364. County×category: /nj/bergen-county/electricians,
  /pa/montgomery-county/spas. Town×category: 6 Bergen electricians (emerson, montvale,
  oradell, park-ridge, river-vale, westwood) + 8 Montgomery spas (ambler, blue-bell,
  collegeville, harleysville, lansdale, montgomery-township, north-wales,
  skippack-township). Plus the 5 profiles. No republish needed — CMS status is read live;
  code was unchanged (temp status endpoint added and deleted without ever shipping).
  Badge check on production: Sanctuary renders grey "Credential on file" on both card and
  profile with zero green-shield markup; InBalance (CZ123155) and Pure Spa (CZ116612) keep
  "License verified"; the Ambler spas page header reads an honest "3 listed · 2
  license-verified". Smoke 19/19, crawl 366 pages 0 broken. NOTE: the QA crawler was lost
  in a scratchpad clean and rewritten — it now strips <script> before extracting hrefs, so
  runtime-built link fragments no longer read as broken links.
  Tranche 3 (Montgomery + Middlesex roofers, 50 URLs) holds for 2026-09-10.

**Gate A — money-page upgrade — 2026-08-27:** Two reference pages built to the go-live spec:
  /nj/bergen-county/westwood/plumbers (2,615 words, 842 unique tokens, 13 FAQs, 150 links)
  and /nj/bergen-county/plumbers (2,203 / 767 / 10 / 146). Baseline was ~1,400; ranking
  median ~2,225. New sections, all four live on both: sourced cost guide (16 rows) above the
  listings, sortable real-<table> comparison, municipal permit/licensing block, Census
  housing context incl. B25034 era table. New data layer: data/money/{cost-guides,
  permit-offices,town-housing}.csv → generated modules (same CSV-as-truth pattern as guides),
  src/lib/moneypage.ts, scripts/fetch-town-housing.ts (Census Reporter API + Census
  gazetteer for GEOIDs; needs a User-Agent header or it 403s). 35/36 Bergen towns have
  housing data. Byline + evaluated/verified/listed counters + CollectionPage dateModified
  (from newestChange(), never "today") + FAQPage JSON-LD retained for Bing/AI only.

**Smoke 2026-09-03 01:53 UTC:** PASS — all 19 routes 200

**Smoke 2026-09-07 16:11 UTC:** PASS — all 19 routes 200

**Q&A removed + SITE_URL pinned — 2026-09-07:** Public Q&A taken off profiles per Lucas —
  a question form only works if the business can answer it, and that needs a per-business
  inbox we don't operate. Contact is now direct: tap-to-call, tap-to-email (new Email button,
  renders only where an email is on file) and website. Removed: QASection.astro,
  /api/submit-question, fetchQuestionsFor/SiteQuestion, the owner-inbox Q&A tab and its
  answer-question action. The `questions` collection is retained per the never-delete rule.
  Separately: the custom domain went live mid-session (www.licensedlist.com). Canonicals,
  og:url and the sitemap were still emitting the temp Wix host, which now 404s on deep URLs,
  so SITE_URL is pinned to https://www.licensedlist.com (Gate C step 1 done early — it was
  an active indexing bug, not a migration choice). Smoke 19/19 against the new host.
  STILL OPEN on the domain: robots.txt is dashboard-managed and still advertises the old
  sitemap URL; the temp host 301s only its homepage and 404s deep URLs.

**Smoke 2026-09-07 18:06 UTC:** PASS — all 19 routes 200

**LicensedList launch §1–§3 — 2026-09-07:** Renamed TriVetted → LicensedList across 53
  files (src, data CSVs, docs, public); tagline now "Every listing checked against the state
  license registry."; "Vetted" retired as a name (US TM 97249765). Normalized 47 stray
  British "licence" spellings to US "license". Added favicon.svg + og-default.png (neither
  existed) and wired icon/OG/Twitter tags. Deleted the dead Vibe-era SPA tree
  (Router/Header/Footer/Head/HomePage .tsx — unreachable, still carried old branding).
  Gate C: SITE_URL pinned to https://www.licensedlist.com; verified apex→www 301, old-host
  homepage→new 301 single hop, old-host DEEP URLs 404 (Wix mapped root only — reported, not
  fixable from our side); no page 200s on both hosts; no stray dev noindex; AI crawlers
  (ClaudeBot, OAI-SearchBot) both served 200 with full HTML.
  Gate B: split sitemaps at extensionless paths (Wix still 404s .xml) — index + 6 sections;
  **indexable URLs pruned 364 → 197** (town hubs 162→35 indexable, categories 69→28) with
  matching noindex on the pruned pages; /directory HTML sitemap (196 links); "Recently
  added" homepage module; rel=sponsored restricted to paid placements only (agency clients
  now followed + visibly disclosed, documented on /editorial-policy).
  Bug found and fixed in the same pass: computeIndexability looped counties once per town,
  inflating county×category counts so /directory linked 28 sub-threshold pages that 404'd.
  Crawler moved into the repo (scripts/crawl.mjs) and made polite after a fast crawl tripped
  Wix rate limiting. Final: smoke 19/19, crawl 644 pages **0 broken**.
