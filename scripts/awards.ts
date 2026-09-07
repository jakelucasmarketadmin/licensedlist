/**
 * LicensedList Best of {County} {Year} — winner computation (C4).
 *
 *   npx tsx scripts/awards.ts [--year 2027] [--reviews data/exports/reviews.csv]
 *
 * Data-driven, never pay-to-play. Criteria (all required):
 *   1. licenseStatus = verified
 *   2. ≥5 published verified-hire on-site reviews
 *   3. aspect average (all four aspects pooled) ≥ 4.7
 *   4. responseTimeHours < 24
 *   5. no unresolved complaints (ownerFlag'd reviews resolved; manual check)
 *
 * Inputs: data/businesses-merge.csv + a dashboard CSV export of the `reviews`
 * collection (the collection is admin-read; export via CMS → Reviews →
 * Export). Output: data/awards/{year}-winners.csv — reviewed by the operator,
 * then imported into the `awards` collection (status=pending → published).
 * The pipeline runs today and simply emits zero winners until enough
 * verified-hire review data exists.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const year = Number(arg("year")) || new Date().getFullYear();
const reviewsPath = arg("reviews") ?? join(root, "data/exports/reviews.csv");

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const businesses = parseCsv(readFileSync(join(root, "data/businesses-merge.csv"), "utf8"));
const reviews = existsSync(reviewsPath) ? parseCsv(readFileSync(reviewsPath, "utf8")) : [];
if (!reviews.length)
  console.log(`no reviews export at ${reviewsPath} — computing with zero on-site reviews (no winners expected)`);

const truthy = (v: string) => v === "true" || v === "TRUE" || v === "1";

const winners: Record<string, string>[] = [];
for (const b of businesses) {
  if (b.status !== "published" || b.licenseStatus !== "verified") continue;
  const mine = reviews.filter(
    (r) => r.businessSlug === b.slug && r.moderationStatus === "published" && truthy(r.verifiedHire),
  );
  if (mine.length < 5) continue;
  const aspects: number[] = [];
  let unresolved = 0;
  for (const r of mine) {
    if (r.ownerFlag && !r.ownerFlagResolvedAt) unresolved++;
    try {
      const a = JSON.parse(r.aspectsJson || "{}");
      for (const k of ["quality", "communication", "value", "timeliness"]) {
        const v = Number(a[k]);
        if (v >= 1 && v <= 5) aspects.push(v);
      }
    } catch { /* skip malformed */ }
  }
  if (unresolved > 0) continue;
  const aspectAvg = aspects.length ? aspects.reduce((s, v) => s + v, 0) / aspects.length : 0;
  if (aspectAvg < 4.7) continue;
  if (!(Number(b.responseTimeHours) < 24)) continue;
  winners.push({
    businessSlug: b.slug,
    businessName: b.name,
    year: String(year),
    stateSlug: b.stateSlug,
    countySlug: b.countySlug,
    categorySlug: b.primaryCategorySlug,
    verifiedHireReviews: String(mine.length),
    aspectAvg: aspectAvg.toFixed(2),
    responseTimeHours: b.responseTimeHours,
    status: "pending",
  });
}

mkdirSync(join(root, "data/awards"), { recursive: true });
const out = join(root, `data/awards/${year}-winners.csv`);
const header = ["businessSlug","businessName","year","stateSlug","countySlug","categorySlug","verifiedHireReviews","aspectAvg","responseTimeHours","status"];
writeFileSync(out, [header.join(","), ...winners.map((w) => header.map((h) => w[h] ?? "").join(","))].join("\n") + "\n");
console.log(`${winners.length} winner(s) for ${year} → ${out} (review, then import to the awards collection as pending → published)`);
