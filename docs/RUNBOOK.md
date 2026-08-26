# Runbook — importing real businesses

## 1. Prepare the CSV

Fill `data/clients-import.csv` in the exact shape of
[data/clients-import-template.csv](../data/clients-import-template.csv). Rules the validator
enforces (rejects land in `data/import-rejects.csv` with a reason — a bad row is never
partially imported):

- Required: `name`, `slug`, `primaryCategorySlug`, `stateSlug`, `countySlug`, `townSlug`, `phone`.
- Every slug must exist in the seeded data: categories from `data/taxonomy/categories.csv`
  (e.g. **`gutter-services`, not `gutters`** — the template's example row deliberately shows
  a reject), towns/counties from `data/geo/*.csv`, and all `serviceTownSlugs` must be in the
  row's own state.
- `licenseVerifiedAt` (a real date) is required whenever `licenseSource` is set.
- `hoursJson` must be valid JSON; `tier` one of free|verified|featured|sponsor.

The importer derives the rest: `pathKey`, town-centroid lat/lng (Census), `photosJson` from
`photoUrls`, and `licenseStatus` (verified ⇢ number+source+date present; else unverified for
license-required categories, not-required otherwise). **Publishing rule:** rows publish only
when verified or license-not-required; everything else imports as `draft` and is listed in
`data/needs-verification.csv`.

## 2. Validate (no credentials needed)

```bash
cd tri-state-directory
npx tsx scripts/import-businesses.ts data/clients-import.csv --dry-run
```

This prints the summary and writes `data/import-rejects.csv`,
`data/needs-verification.csv`, and `data/businesses-merge.csv`. Fix rejects and re-run until
clean.

## 3a. Import via API (preferred once credentials exist)

With a site API key (Dashboard → Settings → API keys, Wix Data permissions):

```bash
WIX_API_KEY=... WIX_SITE_ID=04efedc9-0e97-410c-98a1-d253a2a55945 \
  npx tsx scripts/import-businesses.ts data/clients-import.csv --dry-run   # review plan
WIX_API_KEY=... WIX_SITE_ID=... npx tsx scripts/import-businesses.ts data/clients-import.csv
```

Upserts on `slug` — safe to re-run; never duplicates.

## 3b. Import via the CMS dashboard (today's path, no credentials)

1. **Back up first** (project rule): Businesses collection → More Actions → **Export to CSV**
   → save into `backups/businesses-YYYY-MM-DD.csv`.
2. Businesses collection → More Actions → **Import items** → choose
   `data/businesses-merge.csv`.
3. In "Configure Columns to Import": every column should map to the **existing field of the
   same key** (they were created in Phase 1/2). Watch the type inference — if a column shows
   as anything odd (Reference, deselected), fix it to the existing field before importing.
4. Import, then spot-check a row.

**Caveat:** the dashboard importer only *creates* rows — it cannot upsert on `slug`. It is
safe for the first import of new businesses. For corrections/re-imports, either edit rows in
the dashboard or use the API path (3a); re-importing the same merge CSV would duplicate rows.

## 4. Publish and verify

Code changes deploy on push + Vibe-editor Publish, but **CMS data is live immediately** — new
businesses appear as soon as the import finishes (pages cache for ~60s).

Then verify: run the crawl (`scratchpad shooter/crawl.mjs` or any link checker) and confirm
which town×category / county×category pages now meet the 3-listing rule and return 200.

## 5. Weekly intake (Jotform)

Businesses add or update listings through the Jotform at
`https://form.jotform.com/262358080828059`, embedded on `/for-businesses/get-listed`
(the old Wix form remains as a hidden fallback at `/for-businesses/get-listed-basic`).

Weekly routine:

```bash
JOTFORM_API_KEY=... npx tsx scripts/jotform-to-import.ts            # all submissions
JOTFORM_API_KEY=... npx tsx scripts/jotform-to-import.ts --since 2026-08-24
```

This writes `data/intake/{date}-submissions.csv` in the clients-import shape plus a
trailing `reviewNotes` column. Mapping rules: towns resolve state-scoped against the
seeded towns; category label matches name → synonyms → substring; unresolvable towns,
counties-as-service-areas, categories, the submitted license state, uploads, and social
links all land in `reviewNotes` — nothing is silently dropped. `licenseVerifiedAt` is
always blank; `isClient=false`, `tier=free` unless told otherwise.

Then the normal path: fix anything in `reviewNotes`, run
`npx tsx scripts/import-businesses.ts data/intake/{date}-submissions.csv --dry-run`,
verify licenses (docs/VERIFICATION.md), and import per §3.

**Prefill parameters** (Jotform prefills by field *unique name*; inspected on the live
form):

- `q3_textbox1` — Business Name
- `q2_radio0` — the Add/Update choice (`Update an existing listing` preselects Update)
- `profileUrl` — passed by profile claim banners but **the form has no matching field
  yet**; add a short-text field with unique name `profileUrl` in the Jotform builder to
  capture which profile the update refers to.

Profile claim banners link to
`https://form.jotform.com/262358080828059?q2_radio0=Update+an+existing+listing&q3_textbox1={name}&profileUrl={SITE_URL}/business/{slug}`
(built by `jotformUpdateUrl()` in `src/lib/jotform.ts`).

**GHL forwarding**: to POST each submission to the claim webhook, paste this URL in
Jotform → Settings → Integrations → Webhooks:
`https://my-site-nf00gfth-tier201.wix-vibe-site.com/api/webhook-forward?type=claim`
Our endpoint forwards the payload to `GHL_CLAIM_WEBHOOK` (server env) with 3× retry and
logs to the webhookLog collection; if `GHL_CLAIM_WEBHOOK` is unset it no-ops safely.
Swap the origin for the custom domain once connected.

## 6. Town photos (Wikimedia Commons)

Curated place photography lives in `data/geo/town-photos.csv` (scope county|town, direct
Commons thumb URL, author, license, sourceUrl, caption, alt). The generator validates every
row (Commons host, credit fields, geo slugs) and emits `src/data/town-photos.generated.ts`;
`/credits` renders from the same data. Rules: CC BY / CC BY-SA / PD / CC0 only; captions are
factual; every page showing one renders the caption + credit link.

To add or replace a photo: find the file on commons.wikimedia.org, check the license, copy
the ~1600px thumb URL (Commons only serves width buckets 120/250/330/500/960/1280/1920),
add the CSV row, run `node scripts/generate-data-modules.mjs`, commit.

**Migration to Wix Media (optional, later)**: upload the files via dashboard Media Manager,
swap the CSV `url` values for the wixstatic URLs (the image pipeline auto-detects the host
and switches to Wix URL transforms), keep author/license/sourceUrl untouched — attribution
obligations survive re-hosting.

## 7. Business photos (probe & mirror)

Card images use a fallback ladder: business photo → town/county photo (credited, from
`data/geo/town-photos.csv`) → illustrated category tile. Broken images remove themselves
client-side and reveal the next rung, so a dead link never shows a gray box.

- **Weekly health check** (no credentials): `npx tsx scripts/mirror-photos.ts --probe`
  HEAD-checks every `photosJson`/`logoUrl` URL and writes `data/photo-meta.csv`.
- **Mirror into our Wix Media** (stop hotlinking client sites):
  `WIX_API_KEY=... WIX_SITE_ID=04efedc9-... npx tsx scripts/mirror-photos.ts --mirror`
  imports each external photo via the Media Import API and rewrites the record's
  photosJson to our static.wixstatic.com URLs (idempotent; failures keep the original
  URL). The key needs **Wix Media + Wix Data** permissions (Dashboard → Settings → API
  keys). Not yet run — waiting on an API key.
- Gotcha: `/v1/fill/` transforms only work on Wix Media URLs that already carry a `/v1/`
  segment; hand-building transforms onto a bare `...~mv2.jpg` URL returns 403, so the
  pipeline serves bare media URLs untouched.

## 8. Reviews, Q&A & the owner inbox (Batch B)

### Review invitations (the 7-day clock)
- Owner marks a lead **won** in `/owner` → `wonAt` stamps. 7 days later the consumer gets a
  one-time review link; 7 more days without a submission → one reminder. That's all
  handled by `POST /api/review-invites`, which must be pinged daily:
  - Set env `REVIEW_CRON_SECRET` (any long random string) and `GHL_REVIEW_WEBHOOK` (a GHL
    inbound-webhook workflow that sends the actual email using payload fields
    `email, name, businessSlug, reviewUrl, type` where type is `review-invite` or
    `review-reminder`).
  - Schedule the ping from GHL (recurring workflow → custom webhook) or any cron service:
    `curl -X POST -H "x-cron-secret: $REVIEW_CRON_SECRET" https://<site>/api/review-invites`
  - Without `REVIEW_CRON_SECRET` the endpoint answers 503 and does nothing.
- Invitation emails MUST go to every won lead (FTC — see docs/REVIEWS.md). Never add
  sentiment filtering to the GHL workflow.

### Moderation queue
- CMS dashboard → **Reviews** → filter `moderationStatus = pending`. Check identity + job
  linkage only, then set `published` or `rejected`. `ownerFlag` marks owner re-check
  requests. Same drill for **Questions** (publish only once `answer` is filled).

### Owner inbox
- `/owner` (requires approved claim) now has Inbox tabs: **Leads** (pipeline
  new→contacted→won/lost — won starts the review clock), **Reviews** (public responses;
  "Suggest a reply" uses `ANTHROPIC_API_KEY` when set, else a labeled template; owner
  always edits and posts manually), **Q&A** (answers await dashboard publish).

### Jotform — new optional questions (add to the intake form; label-matched, any qid)
| Label starts with | Type | Maps to |
| --- | --- | --- |
| `Highlights` | checkboxes: Licensed, Insured, Family-owned, Emergency service, Free estimates, Financing, Warranty, Eco-friendly, Background-checked | `businesses.highlights` (slugged) |
| `Services & typical prices` | long text, one `service: price` per line | `services` + `data/intake/*-service-prices.csv` sidecar → servicePrices collection |
| `Team members` | long text, one `Name — role — bio` per line | `teamJson` |
| `Recent projects` | long text, one `Title — town — description` per line | `projectsJson` |

### Collections touched in Batch B
- New: `reviews`, `servicePrices`, `questions` (all admin-only read/write; the site reads
  them elevated server-side).
- New fields: `businesses.{highlights,projectsJson,teamJson,faqJson}`,
  `leads.{wonAt,reviewToken,reviewInviteSentAt,reviewReminderSentAt,reviewSubmittedAt}`.

## 9. Registry seeding & founding members (C0)

- Seeding: `scripts/seed-registry.ts` (sources, counts, ingest flow) — full doc in
  docs/REGISTRY.md. The ingest endpoint is TEMPORARY; add it back from git history
  (api/admin-registry.ts), run on the dev preview origin, delete before publish.
- Claim approvals for registry rows: verify the claimant against the license record
  (name/license number match), then in the dashboard flip the row `status registered →
  published`, fill townSlug/serviceTownSlugs/description, set `claimed = true`. If they're
  within the first 200 approved claims in their county, also set `foundingMember = true`
  and `foundingCounty = "{stateSlug}|{countySlug}"` — /founding-members counters read
  these live. Founding members get the Verified plan free for life (tier = verified, no
  billing).
- Jotform: add a short-text field with unique name `licenseNumber` — the registry table's
  claim buttons prefill it.
- Monthly refresh: re-run the seeder per source (dedupe makes it additive); expired
  licenses get flipped to `status = lapsed` (hidden). PA PALS CSVs are a manual monthly
  download (docs/REGISTRY.md).
