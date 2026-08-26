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
