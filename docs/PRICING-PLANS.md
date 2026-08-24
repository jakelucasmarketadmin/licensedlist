# Wix Pricing Plans setup (owner steps) + tier operations

The site side is live: `/pricing` shows monthly + annual prices, the Featured request flow
enforces the 3-per-category-per-county cap at request time (open slot → reserved request;
full → waitlist recorded in `claims` with `method=waitlist`), the Terms carry the plan
language, and expired Featured tiers lapse automatically (`featuredUntil` is enforced in the
templates — a past date drops the placement without any manual step).

## 1. One-time dashboard setup (needs the owner — payments + app installs)

1. **Wix Payments:** Dashboard → Settings → Accept payments → complete payout setup.
2. **Pricing Plans app:** Dashboard → Apps → add "Wix Pricing Plans" (free app).
3. Create four plans (Pricing Plans → Create plan → "Membership"):
   - `Verified — Monthly` $29/month, recurring, no free trial
   - `Verified — Annual` $290/year, recurring
   - `Featured — Monthly` $99/month, recurring
   - `Featured — Annual` $990/year, recurring
   Description on each: "Paid placement is always labeled and never changes rankings or
   reviews." Allow cancellation anytime (benefits run to period end — Wix default).
4. Copy each plan's payment-page link (Pricing Plans → plan → Share) and send them to
   Claude to wire into the request-flow emails / CTAs.

## 2. Ongoing operations (until purchase automation exists)

On a purchase notification email from Wix:

| Event | Do this in the Businesses collection |
| --- | --- |
| Verified purchased | `tier = verified`; run the license check; badge only when it passes |
| Featured purchased | `tier = featured`; `featuredUntil` = end of paid period (renewals: extend it) |
| Cancellation | nothing — the tier lapses automatically when `featuredUntil` passes; for Verified set `tier = free` at period end |
| Waitlist slot opens | check `claims` where `method = waitlist` for that county/category (oldest first), email them the plan link |

Featured cap safety: the request flow already blocks over-cap requests, and even a manual
mistake can't over-fill a page — the featured block renders at most 3.

## 3. Automation (later)

When ready to automate: Wix Automations → trigger "Pricing plan purchased" → webhook to a
site endpoint that sets `tier`/`featuredUntil` (same elevated-update pattern as
`/api/owner-listing`). Not built yet — manual table above is the source of truth.
