/**
 * "You're listed" notice for unclaimed public-records listings (opt-in to
 * claim, easy opt-out). Copy approved 2026-08-27; send in batches of 5 with a
 * day between so a wrong-address problem surfaces before it hits everyone.
 *
 *   npx tsx scripts/notify-listed.ts --base https://<site-or-preview-origin> \
 *       --secret $REVIEW_CRON_SECRET [--limit 5] [--dry-run]
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
const limit = Number(arg("limit")) || 5;
if (!base || !secret) {
  console.error("usage: npx tsx scripts/notify-listed.ts --base <origin> --secret <cron-secret> [--limit 5] [--dry-run]");
  process.exit(1);
}

const res = await fetch(`${base.replace(/\/$/, "")}/api/notify-listed`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-cron-secret": secret },
  body: JSON.stringify({ dryRun, limit }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.ok) {
  console.error(`HTTP ${res.status}:`, JSON.stringify(body).slice(0, 400));
  process.exit(1);
}
console.log(dryRun ? "WOULD notify:" : "notified:");
for (const row of body.results ?? []) console.log(` ${row.slug} <${row.email}> ${row.sent ? "✓" : row.note ?? ""}`);
console.log(`${(body.results ?? []).length} listing(s) — batch cap ${limit}. Wait a day before the next batch.`);
