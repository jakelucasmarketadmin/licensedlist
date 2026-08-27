# Listing notice email — DRAFT, do not send until approved

Rail: GHL_NOTICE_WEBHOOK workflow, payload fields {email, businessName,
profileUrl, claimUrl, removeUrl}. One send per business, ever (notifiedAt).
Trigger: scripts/notify-listed.ts (HOLD until Lucas approves this copy).

---

**Subject:** {{businessName}} is listed on TriVetted — claim it free, or have it removed

Hi —

Your business, **{{businessName}}**, appears on TriVetted, a local directory
for New Jersey, New York, and Pennsylvania that verifies contractor and
professional licenses against the official state registries.

Your listing is here: {{profileUrl}}

It was compiled from public records and your own website, and it's marked
"Unclaimed" — we're not affiliated with you, and we don't take quote requests
for you unless you opt in.

Two options, both free:

1. **Claim it** ({{claimUrl}}) — takes about 3 minutes. You get to correct
   anything, add photos and services, receive quote requests from homeowners,
   and respond to reviews. Claiming is free, forever.

2. **Remove it** ({{removeUrl}}) — no questions asked. We take the listing
   down within 2 business days and never re-add it.

If we don't hear from you, the listing simply stays as it is — public
information, clearly labeled as unclaimed.

Why we exist: every "Verified" badge on TriVetted names the official registry
it was checked against and the date we checked. Rankings are never for sale.
You can read exactly how it works at {{profileUrl}}/../../how-we-verify.

— The TriVetted team
admin@tier201.com

*You're receiving this one-time notice because your business appears in
public licensing/business records for our coverage area. There is no mailing
list to unsubscribe from — this is the only email unless you claim your
listing.*
