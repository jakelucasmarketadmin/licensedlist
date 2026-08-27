# Listing notice email — APPROVED 2026-08-27 (Lucas), send in batches of 5

Rail: GHL_NOTICE_WEBHOOK workflow, payload fields {email, businessName,
profileUrl, claimUrl, removeUrl}. One send per business, ever (`notifiedAt`).
Trigger: `scripts/notify-listed.ts --limit 5` — batches of 5, a day apart, so a
wrong-address or bounce problem surfaces before it reaches everyone.

Approved-copy constraints (do not silently drift from these):

1. Lead with the fact, not the pitch. Line 1 = you are listed. Line 2 = it is
   free and always will be. Line 3 = how to claim or remove.
2. No subject line that implies they signed up for anything.
3. The profile URL and the removal URL appear as plain text in the body — not
   behind a button only. Many of these are read on a phone with images off.

---

**Subject:** Your business appears on TriVetted — here's the listing

Hi —

**{{businessName}}** is listed on TriVetted, a directory of licensed local
businesses in New Jersey, New York, and Pennsylvania. Your listing is here:

{{profileUrl}}

It's free, and it always will be. We compiled it from public records and your
own website, so it's marked "Unclaimed" — we're not affiliated with you, and
we don't accept quote requests on your behalf.

Two things you can do, both free:

**Claim it** — about 3 minutes. You can correct anything, add photos and
services, receive quote requests, and reply to reviews:
{{claimUrl}}

**Remove it** — no questions asked, down within 2 business days, never
re-added:
{{removeUrl}}

If we don't hear from you, the listing stays as it is: public information,
clearly labeled unclaimed.

One note on what the badges mean. Every "License verified" mark on TriVetted
names the official registry it was checked against and the date we checked it.
Placement is never for sale.

— The TriVetted team
admin@tier201.com

*This is a one-time notice, sent because your business appears in public
records for our coverage area. There's no mailing list to unsubscribe from —
you won't get another email unless you claim your listing or write back.*
