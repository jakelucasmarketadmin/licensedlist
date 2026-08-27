/**
 * Import real client businesses from a CSV shaped like
 * data/clients-import-template.csv.
 *
 * Usage (run with tsx — see docs/RUNBOOK.md):
 *
 *   npx tsx scripts/import-businesses.ts data/clients-import.csv [--dry-run]
 *
 * What it always does (no credentials needed):
 *   - validates every row against the seeded geo + category data,
 *   - writes data/import-rejects.csv        (bad rows + reason; never partially imported)
 *   - writes data/needs-verification.csv    (rows imported as draft pending license check)
 *   - writes data/businesses-merge.csv      (dashboard-importer shape, valid rows only)
 *
 * What it does with WIX_API_KEY + WIX_SITE_ID in the environment:
 *   - upserts valid rows into the `businesses` collection on `slug`
 *     (create or update, never duplicate). `--dry-run` prints the plan instead
 *     of writing to the CMS.
 *
 * Publishing rule: status = "published" only when the license is verified or
 * the category doesn't require one; otherwise "draft" + needs-verification.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { STATE_SEED, COUNTY_SEED, TOWN_SEED } from "../src/data/geo.generated.ts";
import { CATEGORY_SEED } from "../src/data/taxonomy.generated.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
if (!csvPath) {
  console.error("usage: npx tsx scripts/import-businesses.ts <csv> [--dry-run]");
  process.exit(1);
}

// ---------- CSV helpers (RFC 4180) ----------
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
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
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const writeCsv = (path: string, header: string[], rows: Record<string, unknown>[]) =>
  writeFileSync(
    path,
    [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h])).join(","))].join("\n") + "\n",
  );

// ---------- reference data ----------
const states = new Set(STATE_SEED.map((s) => s.slug));
const countiesByState = new Map(
  STATE_SEED.map((s) => [s.slug, new Set(COUNTY_SEED.filter((c) => c.stateSlug === s.slug).map((c) => c.slug))]),
);
const townIndex = new Map(TOWN_SEED.map((t) => [`${t.stateSlug}|${t.slug}`, t]));
const categories = new Map(CATEGORY_SEED.map((c) => [c.slug, c]));
const list = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIERS = new Set(["free", "verified", "featured", "sponsor"]);

// ---------- validate ----------
interface ValidRow {
  fields: Record<string, unknown>;
  needsVerification: boolean;
}
const raw = parseCsv(readFileSync(isAbsolute(csvPath) ? csvPath : join(root, csvPath), "utf8"));
const rejects: Record<string, unknown>[] = [];
const needsVerification: Record<string, unknown>[] = [];
const valid: ValidRow[] = [];
const seenSlugs = new Set<string>();

for (const [i, r] of raw.entries()) {
  const problems: string[] = [];
  const rowNo = i + 2; // header is line 1

  for (const req of ["name", "slug", "primaryCategorySlug", "stateSlug", "countySlug", "townSlug", "phone"]) {
    if (!r[req]) problems.push(`missing required field ${req}`);
  }
  if (r.slug && !SLUG_RE.test(r.slug)) problems.push(`slug "${r.slug}" is not lowercase-hyphen`);
  if (r.slug && seenSlugs.has(r.slug)) problems.push(`duplicate slug "${r.slug}" in file`);

  if (r.stateSlug && !states.has(r.stateSlug)) problems.push(`unknown stateSlug "${r.stateSlug}"`);
  const countySet = countiesByState.get(r.stateSlug);
  if (r.countySlug && countySet && !countySet.has(r.countySlug))
    problems.push(`countySlug "${r.countySlug}" not in state "${r.stateSlug}"`);
  const homeTown = townIndex.get(`${r.stateSlug}|${r.townSlug}`);
  if (r.townSlug && (!homeTown || homeTown.countySlug !== r.countySlug || homeTown.stateSlug !== r.stateSlug))
    problems.push(`townSlug "${r.townSlug}" not a seeded town of ${r.stateSlug}/${r.countySlug}`);

  const cats = new Set(list(r.categorySlugs || ""));
  if (r.primaryCategorySlug) cats.add(r.primaryCategorySlug);
  for (const cat of cats) if (!categories.has(cat)) problems.push(`unknown category slug "${cat}"`);

  const serviceTowns = list(r.serviceTownSlugs || "");
  for (const t of serviceTowns) {
    const town = townIndex.get(`${r.stateSlug}|${t}`);
    if (!town) problems.push(`serviceTownSlug "${t}" does not exist in ${r.stateSlug}`);
  }

  if (r.licenseVerifiedAt && Number.isNaN(Date.parse(r.licenseVerifiedAt)))
    problems.push(`licenseVerifiedAt "${r.licenseVerifiedAt}" is not a date`);
  if (r.tier && !TIERS.has(r.tier)) problems.push(`tier "${r.tier}" not in free|verified|featured|sponsor`);
  if (r.hoursJson) {
    try { JSON.parse(r.hoursJson); } catch { problems.push("hoursJson is not valid JSON"); }
  }

  if (problems.length) {
    rejects.push({ row: rowNo, slug: r.slug, name: r.name, reason: problems.join("; ") });
    continue;
  }
  seenSlugs.add(r.slug);

  const primaryCat = categories.get(r.primaryCategorySlug)!;
  const licenseVerified = Boolean(r.licenseNumber && r.licenseSource && r.licenseVerifiedAt);
  // A license claim that hasn't passed registry verification (source set, no
  // verified date) never publishes, even in a not-required category.
  const unverifiedClaim = Boolean(r.licenseSource && !r.licenseVerifiedAt);
  const licenseStatus = licenseVerified
    ? "verified"
    : primaryCat.licenseRequired || unverifiedClaim
      ? "unverified"
      : "not-required";
  const published = licenseStatus === "verified" || (!primaryCat.licenseRequired && !unverifiedClaim);
  if (!published)
    needsVerification.push({
      slug: r.slug,
      name: r.name,
      primaryCategorySlug: r.primaryCategorySlug,
      state: r.stateSlug,
      reason: unverifiedClaim
        ? "license claim did not pass registry verification — imported as draft"
        : "licenseRequired category without a verified license — imported as draft",
    });

  const photoUrls = list(r.photoUrls || "");
  const fields: Record<string, unknown> = {
    name: r.name,
    slug: r.slug,
    status: published ? "published" : "draft",
    tier: r.tier || "free",
    isClient: r.isClient === "true" ? "true" : "false",
    claimed: "false",
    primaryCategorySlug: r.primaryCategorySlug,
    categorySlugs: [...cats].join(","),
    stateSlug: r.stateSlug,
    countySlug: r.countySlug,
    townSlug: r.townSlug,
    serviceTownSlugs: serviceTowns.length ? serviceTowns.join(",") : r.townSlug,
    pathKey: `${r.stateSlug}/${r.countySlug}/${r.townSlug}`,
    address1: r.address1,
    address2: r.address2,
    city: r.city,
    state: r.state,
    zip: r.zip,
    // Town centroid (Census gazetteer) as the default coordinate.
    lat: homeTown?.lat ?? "",
    lng: homeTown?.lng ?? "",
    phone: r.phone,
    website: r.website,
    email: r.email,
    description: r.description,
    whyWePicked: r.whyWePicked,
    yearsInBusiness: r.yearsInBusiness,
    foundedYear: r.foundedYear,
    services: r.services,
    hoursJson: r.hoursJson,
    logoUrl: r.logoUrl,
    photosJson: photoUrls.length ? JSON.stringify(photoUrls) : "",
    licenseStatus,
    licenseNumber: r.licenseNumber,
    licenseSource: r.licenseSource,
    licenseHolder: r.licenseHolder ?? "",
    additionalLicensesJson: r.additionalLicensesJson ?? "",
    licenseVerifiedAt: r.licenseVerifiedAt,
    insuredStatus: r.insuredStatus || "unknown",
    ratingGoogle: r.ratingGoogle,
    ratingGoogleCount: r.ratingGoogleCount,
    ratingYelp: r.ratingYelp,
    ratingYelpCount: r.ratingYelpCount,
    ratingFacebook: r.ratingFacebook,
    ratingFacebookCount: r.ratingFacebookCount,
    responseTimeHours: r.responseTimeHours,
    lastVerifiedAt: r.licenseVerifiedAt || "",
    sourceNotes: r.sourceNotes,
  };
  valid.push({ fields, needsVerification: !published });
}

// ---------- reports ----------
writeCsv(join(root, "data/import-rejects.csv"), ["row", "slug", "name", "reason"], rejects);
writeCsv(
  join(root, "data/needs-verification.csv"),
  ["slug", "name", "primaryCategorySlug", "state", "reason"],
  needsVerification,
);
const MERGE_HEADER = [
  "name","slug","status","tier","isClient","claimed","primaryCategorySlug","categorySlugs",
  "stateSlug","countySlug","townSlug","serviceTownSlugs","pathKey","address1","address2",
  "city","state","zip","lat","lng","phone","website","email","description","whyWePicked",
  "yearsInBusiness","foundedYear","services","hoursJson","logoUrl","photosJson",
  "licenseStatus","licenseNumber","licenseSource","licenseHolder","additionalLicensesJson","licenseVerifiedAt","insuredStatus",
  "ratingGoogle","ratingGoogleCount","ratingYelp","ratingYelpCount","ratingFacebook",
  "ratingFacebookCount","responseTimeHours","lastVerifiedAt","sourceNotes",
];
writeCsv(join(root, "data/businesses-merge.csv"), MERGE_HEADER, valid.map((v) => v.fields));

console.log(
  `rows: ${raw.length} · valid: ${valid.length} (${valid.filter((v) => !v.needsVerification).length} publish, ` +
  `${needsVerification.length} draft/needs-verification) · rejected: ${rejects.length}`,
);
if (rejects.length) for (const r of rejects) console.log(`  REJECT row ${r.row} (${r.slug}): ${r.reason}`);

// ---------- CMS upsert (requires credentials) ----------
const apiKey = process.env.WIX_API_KEY;
const siteId = process.env.WIX_SITE_ID;
if (!apiKey || !siteId) {
  console.log(
    "\nNo WIX_API_KEY/WIX_SITE_ID — skipped CMS upsert. Use data/businesses-merge.csv with " +
    "the dashboard importer (docs/RUNBOOK.md) or set credentials to upsert directly.",
  );
  process.exit(rejects.length ? 2 : 0);
}

// @ts-expect-error installed only where this script runs with credentials
const { createClient, ApiKeyStrategy } = await import("@wix/sdk");
// @ts-expect-error installed only where this script runs with credentials
const { items } = await import("@wix/data");
const client = createClient({ modules: { items }, auth: ApiKeyStrategy({ apiKey, siteId }) });

// Existing records by slug AND by license number (paginated). The license
// index makes a Jotform claim MERGE into its C0 registry row (flipping it to
// published) instead of creating a duplicate — see docs/REGISTRY.md.
const existing = new Map<string, any>();
const existingByLicense = new Map<string, any>();
const normLic = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
let query = client.items.query("businesses").limit(1000);
let page = await query.find();
for (;;) {
  for (const item of page.items) {
    if (item.slug) existing.set(item.slug, item);
    if (item.licenseNumber) existingByLicense.set(normLic(item.licenseNumber), item);
  }
  if (!page.hasNext()) break;
  page = await page.next();
}

let creates = 0, updates = 0, optedOut = 0;
for (const { fields } of valid) {
  const slug = fields.slug as string;
  const current =
    existing.get(slug) ??
    (fields.licenseNumber ? existingByLicense.get(normLic(fields.licenseNumber)) : undefined);
  // Opt-out is permanent: a removal-honored record (optOutAt) is never
  // re-added or updated by any import (docs/RUNBOOK.md §14).
  if (current?.optOutAt) {
    console.log(`SKIP ${slug} — optOutAt ${current.optOutAt} (removal honored; never re-add)`);
    optedOut++;
    continue;
  }
  if (dryRun) {
    console.log(`${current ? "UPDATE" : "CREATE"} ${slug} (status=${fields.status})`);
    current ? updates++ : creates++;
    continue;
  }
  if (current) {
    await client.items.update("businesses", { ...current, ...fields, _id: current._id });
    updates++;
  } else {
    await client.items.insert("businesses", fields);
    creates++;
  }
}
console.log(`${dryRun ? "[dry-run] " : ""}creates: ${creates} · updates: ${updates} · opt-out skips: ${optedOut}`);
