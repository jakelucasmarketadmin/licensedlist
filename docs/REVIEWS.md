# Review requests — FTC-compliant flow (spec; implementation is Phase 3)

## Hard rules (from the FTC's Consumer Review Fairness Act guidance + endorsement rules)

1. **No sentiment gating.** Review invitations go to **all** customers of a job, never only
   the likely-happy ones. No "how was it?" pre-screen that routes unhappy customers away
   from public review platforms.
2. **No incentives conditioned on rating or content.** An incentive for leaving *a* review
   (any rating) is allowed only if the incentive is disclosed alongside the review; an
   incentive for a *positive* review is never allowed.
3. **Relationship disclosure.** Reviews collected through TriVetted state that the reviewer
   was a customer whose hire was made through the directory ("verified hire"). Agency-client
   relationships are already disclosed on listings; a review from anyone affiliated with the
   business or the agency is refused.
4. **No suppression.** Negative reviews are published under the same moderation rules as
   positive ones (real customer, real job, no defamation/PII). Owners get a public response
   field, never deletion-by-request.
5. **Truthful aggregate.** On-site `aggregateRating` schema comes only from on-site
   verified-hire ratings — never editorial scores, never third-party platform numbers.

## Flow (Phase 3 build)

1. A lead marked "hired" in the dashboard triggers one review invitation email to the
   consumer N days after job completion (N configurable per category; default 14).
2. Invitation goes to every hired-lead customer (rule 1); one reminder max.
3. Form collects rating, body, job type; `verifiedHire = true`; stored in the `reviews`
   collection as `status = pending`.
4. Moderation checks identity + job linkage only — sentiment is not a factor (rule 4).
5. Published reviews render on the profile with the verified-hire flag and owner response;
   `aggregateRating` emits once a listing has ≥5 published on-site reviews.
6. Every invitation footer: who we are, why they got it, unsubscribe.
