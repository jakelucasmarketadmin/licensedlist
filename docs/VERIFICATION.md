# License verification workflow

The rule above everything: **a business is never marked verified without a recorded source
and date.** Exact-license-number matches are the only auto-appliable result; every softer
match is human-reviewed. PA badges always carry the Attorney General's caveat that
registration is not an endorsement of competency (built into the badge tooltip).

## Running it

Input is a Businesses collection export (Dashboard → Businesses → More Actions → Export to
CSV; save into `backups/`).

```bash
# NYC: bulk-match against NYC Open Data (fetches the live dataset)
npx tsx scripts/verify-licenses.ts --businesses backups/businesses-YYYY-MM-DD.csv --nyc

# NJ: match against a roster export you downloaded (see "NJ sources" below)
npx tsx scripts/verify-licenses.ts --businesses backups/businesses-....csv \
  --nj-roster data/nj-hic-roster.csv --nj-cols "license=License Number,name=Business Name,zip=Zip,status=Status"

# Everything with no bulk feed → manual checklist rows
npx tsx scripts/verify-licenses.ts --businesses backups/businesses-....csv

# Re-verification sweep: published businesses not checked in N days
npx tsx scripts/verify-licenses.ts --businesses backups/businesses-....csv --stale 180
```

Outputs in `data/verification/`:

| File | Meaning | Action |
| --- | --- | --- |
| `license-updates.csv` | Exact license-number matches, with registry status/expiry. `licenseStatus` = verified (active) or suspended (lapsed/revoked). | Apply via `--apply` (needs API key) or paste into the dashboard rows. |
| `manual-review.csv` | Name+ZIP matches (single or multiple candidates) and no-match rows, with confidence. | A person confirms in the registry, then updates the record. Never auto-applied. |
| `manual-checklist.csv` | One row per business needing a hand lookup: registry name, URL, fields to record. | Work through it; record number/status/expiration + today's date. |
| `stale.csv` | Published businesses whose `licenseVerifiedAt` is older than `--stale` days. | Feed back into the flows above. |

The badge template enforces freshness automatically: a verified listing whose
`licenseVerifiedAt` is more than **365 days** old renders the amber **"Verification due"**
badge until re-checked. Suggested cadence: run `--stale 180` monthly.

## Sources by state

**NJ.** No public bulk file is published on data.nj.gov. Options, in order: (1) the DCA
license verification portal for one-off checks — https://newjersey.mylicense.com/verification/
(licensed trades) and the HIC registration lookup at https://www.njconsumeraffairs.gov/hic ;
(2) request the HIC roster / MyLicense export from DCA (public record; an OPRA request to the
Division of Consumer Affairs yields a spreadsheet) and feed it in with `--nj-roster`.
`licenseSource` = "NJ DCA HIC" for home-improvement registrations, or the specific board
(e.g. "NJ Board of Examiners of Electrical Contractors") for licensed trades.

**NJ registration → licensure transition (P.L. 2023, c.237).** The law signed January 8,
2024 creates the **State Board of Home Improvement and Home Elevation Contractors** and
converts HIC/HEC registration into licensure: examination; apprenticeship, trade school, or
two years' supervised experience; insurance; and $100,000 in security (bond, letter of
credit, or securities). Education/training standards take effect **February 1, 2026**; the
general licensing requirement takes effect **six months after the Board adopts rules**;
existing registrants are grandfathered. Operationally: keep verifying DCA registrations
(`licenseSource = "NJ DCA HIC"`) until the Board's licensing requirement is in force, then
switch new verifications to the canonical value
**`licenseSource = "NJ Board of Home Improvement and Home Elevation Contractors"`** — a
data-only change on records and in `data/taxonomy/categories.csv`'s
`licenseSourcesByState.NJ` (no code change; badges print whatever source is recorded).
Sources: the DCA notice
(https://www.njconsumeraffairs.gov/Documents/HIC-HEC-Regarding-Changes-To-The-Law-New-Requirements-For-Registration.pdf),
the statute (https://pub.njleg.state.nj.us/Bills/2022/PL23/237_.PDF), and the Board page
(https://www.njconsumeraffairs.gov/HIHEC).

**NYC.** Bulk feed wired in: NYC Open Data "Legally Operating Businesses" (dataset
`w7w3-xahh`, Socrata), filtered to `business_category = 'Home Improvement Contractor'` —
license number, status, expiration, ZIP. `licenseSource` = "NYC DCWP".

**NY suburbs (no bulk feeds — manual checklist):**

| County | Office | Lookup |
| --- | --- | --- |
| Nassau | Office of Consumer Affairs | https://www.nassaucountyny.gov/1563/Consumer-Affairs |
| Suffolk | Labor, Licensing & Consumer Affairs | https://www.suffolkcountyny.gov/Departments/Labor-Licensing-Consumer-Affairs |
| Westchester | Consumer Protection | https://consumer.westchestergov.com/ |
| Rockland | Office of Consumer Protection | https://rocklandgov.com/departments/consumer-protection/ |
| Orange (future) | Consumer Affairs / clerk | https://www.orangecountygov.com/ |

Record: license number, status, expiration; `licenseSource` = "{County} County HIC".

**PA.** HICPA search at https://hicsearch.attorneygeneral.gov/ — manual only, **do not
scrape it**. Licensed professions verify at https://www.pals.pa.gov/. `licenseSource` =
"PA AG HICPA" or "PA PALS". Every PA badge tooltip carries: "registration is not an
endorsement of the contractor's competency."

## Review discipline

- Exact number, registry active → verified, today's date, source recorded.
- Exact number, registry lapsed/revoked/suspended → **suspended** (badge turns red; listing
  is pulled from published or clearly flagged — decide per case, log it).
- Name+ZIP single candidate → a human opens the registry record and confirms before editing.
- Multiple candidates or no match → treat as unverified until resolved; the listing stays
  draft (license-required categories) per the publishing rule.
