/**
 * "You're listed" notice for unclaimed public-records listings (opt-in to
 * claim, easy opt-out). HOLD: do not run until the copy in
 * docs/outreach/listing-notice.md is approved.
 *
 *   npx tsx scripts/notify-listed.ts --base https://<site-or-preview-origin> \
 *       --secret $REVIEW_CRON_SECRET [--dry-run]
 *
 * Calls POST /api/notify-listed on the site, which selects every published
 * business with listingSource=public-records, an email on file, no
 * notifiedAt, and no optOutAt; sends one notice each via GHL_NOTICE_WEBHOOK
 * (payload: email, businessName, profileUrl, claimUrl, removeUrl) and stamps
 * notifiedAt. --dry-run lists who WOULD be notified without sending.
 */
const args = process.argv.slice(2);
const arg = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const base = arg("base");
const secret = arg("secret");
const dryRun = args.includes("--dry-run");
if (!base || !secret) {
  console.error("usage: npx tsx scripts/notify-listed.ts --base <origin> --secret <cron-secret> [--dry-run]");
  process.exit(1);
}

const res = await fetch(`${base.replace(/\/$/, "")}/api/notify-listed`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-cron-secret": secret },
  body: JSON.stringify({ dryRun }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.ok) {
  console.error(`HTTP ${res.status}:`, JSON.stringify(body).slice(0, 400));
  process.exit(1);
}
console.log(dryRun ? "WOULD notify:" : "notified:");
for (const row of body.results ?? []) console.log(` ${row.slug} <${row.email}> ${row.sent ? "✓" : row.note ?? ""}`);
console.log(`${(body.results ?? []).length} listing(s)`);
