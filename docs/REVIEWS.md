# Reviews — FTC-compliant flow (LIVE as of Batch B)

## Hard rules (from the FTC's Consumer Review Fairness Act guidance + endorsement rules)

1. **No sentiment gating.** Review invitations go to **all** customers of a won job, never only
   the likely-happy ones. No "how was it?" pre-screen that routes unhappy customers away
   from public review platforms. (Enforced in code: `/api/review-invites` selects every
   `status=won` lead with no filter other than "has an email".)
2. **No incentives conditioned on rating or content.** An incentive for leaving *a* review
   (any rating) is allowed only if the incentive is disclosed alongside the review; an
   incentive for a *positive* review is never allowed. (We currently offer no incentives.)
3. **Relationship disclosure.** "Verified hire via TriVetted" means the reviewer hired the
   business through a TriVetted quote request and got the one-time link after the job.
   Agency-client relationships are disclosed on listings; reviews from anyone affiliated
   with the business or the agency are refused in moderation.
4. **No suppression.** Negative reviews are published under the same moderation rules as
   positive ones (real customer, real job, no defamation/PII). Owners get a public response
   field and a flag-for-recheck button — never deletion-by-request.
5. **Truthful aggregate.** `aggregateRating` JSON-LD comes **only** from published on-site
   reviews and only once a listing has **≥3** of them — never editorial scores, never
   third-party platform numbers. Third-party ratings render as clearly-separated context
   text. DEMO records never emit rating schema.

## The implemented flow

1. Owner marks a lead **won** in `/owner` (Inbox → Leads) → `wonAt` is stamped.
2. **7 days** after `wonAt`, `/api/review-invites` (see RUNBOOK §8 for scheduling) sends the
   consumer ONE review email via the GHL webhook rail, carrying a one-time token link
   (`/write-review?token=…`). One reminder max, 7 days later. Every won lead gets it (rule 1).
3. The token resolves via `/api/review-token`; submission goes through `/api/submit-review`,
   which decides `verifiedHire` **server-side** (valid unused token → true) and stores the
   review as `moderationStatus=pending`. Tokens are single-use (`reviewSubmittedAt`).
4. A public **Write a review** path also exists from every profile (`/write-review?biz=slug`);
   those reviews are labeled **Unverified** and never counted as verified hires.
5. Moderation (CMS dashboard → Reviews, filter `moderationStatus=pending`) checks identity
   and job linkage only — sentiment is never a factor (rule 4). Set to `published` or
   `rejected`. Owner flags land in `ownerFlag` for re-checks.
6. Published reviews render with: overall + aspect bars (Quality, Communication, Value,
   Timeliness), rating histogram, keyword chips from review text, photos, verified-hire
   stamp, inline owner response, sort, and a Report link (`REVIEW_REPORT_EMAIL`).
7. Owner replies: `/owner` Inbox → Reviews. "Suggest a reply" produces an AI-drafted
   suggestion (labeled in the UI; heuristic template when no `ANTHROPIC_API_KEY` is set);
   the owner edits and posts it themselves — drafts are **never** auto-posted.

## Policy text shown to reviewers

The `/write-review` page shows this policy (keep in sync with
`src/views/WriteReviewView.astro`):

- Write about your own, real experience with this business. One review per job.
- Reviews are moderated for identity and job linkage only — we never filter, edit, or
  reorder by rating. Critical reviews are published under the same rules as positive ones.
- "Verified hire" means the hire went through a TriVetted quote request and the review link
  was sent after the job — to every customer, never only the happy ones.
- No reviews from owners, employees, relatives, competitors, or anyone paid to write one.
- Don't include other people's personal information, defamatory claims, or content
  unrelated to the work.
- Owners may post one public response; they cannot edit or remove your review.

## Q&A moderation

Consumer questions (`questions` collection) are `pending` on arrival; the owner answers in
`/owner` Inbox → Q&A; an admin publishes from the dashboard after a policy check. Only
answered + published questions render. Plain HTML — deliberately no FAQ rich-result markup.
