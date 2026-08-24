# Outreach kit (owner runs the outreach; this repo supplies the tooling)

## Workflow

1. `npx tsx scripts/outreach-list.ts --businesses backups/businesses-YYYY-MM-DD.csv`
   → `data/outreach-targets.csv`, sorted by fewest-listings-needed. Work the slots that
   need 1 first (one signup takes a page live), then 2, then 3.
2. Find candidate businesses per slot yourself (Google Maps, chamber lists, referrals —
   **never scrape Google Places or Yelp into the directory**; outreach research ≠ storing
   their data. A listing gets created only from the business's own submission or your
   client CSV).
3. Send emails from the templates below. Track sends/replies in your CRM (GHL).

## CAN-SPAM checklist (every send)

- [ ] Honest subject line — no "Re:", no fake urgency, nothing misleading
- [ ] From-name identifies the sender or the directory, real reply-to address
- [ ] Body includes the sender's **physical postal address** (fill the placeholder!)
- [ ] Clear opt-out line, honored within 10 business days, no fee, no login required
- [ ] The relationship is stated honestly (we found you via public records / your website)
- [ ] Keep an unsubscribe list and suppress it before every batch

Templates: `01-invite.md` (first touch), `02-follow-up.md` (one follow-up, 7+ days later,
skip if opted out), `03-page-going-live.md` (for slots at 2/3 where their signup takes the
page live). One follow-up maximum — two unanswered emails means stop.
