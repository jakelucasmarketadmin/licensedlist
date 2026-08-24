/**
 * License verification workflow — see docs/VERIFICATION.md.
 *
 *   npx tsx scripts/verify-licenses.ts --businesses <export.csv> [options]
 *
 * Sources:
 *   --nyc                 NYC Open Data "Legally Operating Businesses" (w7w3-xahh),
 *                         business_category = Home Improvement Contractor (Socrata, paginated)
 *   --nj-roster <file>    NJ DCA roster/verification export you downloaded (no public bulk
 *                         feed exists; see VERIFICATION.md). Column names via --nj-cols.
 *   --nj-cols a=b,...     Map roster columns, default:
 *                         license=license_no,name=name,zip=zip,status=status
 *
 * Matching: exact license number first (normalized); then normalized business
 * name + ZIP. Only exact-number matches are auto-appliable; every name+zip or
 * partial match goes to manual review with its confidence recorded.
 *
 * Outputs (data/verification/):
 *   license-updates.csv   exact-number matches → licenseStatus/Source/VerifiedAt
 *   manual-review.csv     name+zip or ambiguous matches with confidence
 *   manual-checklist.csv  per-business rows for registries with no bulk feed
 *                         (NY suburban counties, PA HICPA, NJ when no roster given)
 *   stale.csv             with --stale <days>: published businesses whose
 *                         licenseVerifiedAt is older than N days
 *
 * With WIX_API_KEY/WIX_SITE_ID set and --apply, exact-number matches are
 * written to the CMS. Never marks a business verified without a source+date.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(`--${name}`);
const resolve = (p: string) => (isAbsolute(p) ? p : join(root, p));

// ---------- CSV ----------
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
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
  writeFileSync(path, [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h])).join(","))].join("\n") + "\n");

// ---------- normalization ----------
const normLicense = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
const normName = (v: string) =>
  v.toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(LLC|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LP|PC|PLLC|THE)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
const normZip = (v: string) => (v.match(/\d{5}/)?.[0] ?? "");
const today = new Date().toISOString().slice(0, 10);

// ---------- load businesses ----------
const businessesCsv = opt("businesses");
if (!businessesCsv) {
  console.error("--businesses <csv> is required (a Businesses collection export; see docs/RUNBOOK.md for exporting)");
  process.exit(1);
}
interface Biz {
  slug: string; name: string; stateSlug: string; countySlug: string; zip: string;
  status: string; licenseNumber: string; licenseSource: string; licenseVerifiedAt: string;
  licenseStatus: string; primaryCategorySlug: string;
}
const businesses: Biz[] = parseCsv(readFileSync(resolve(businessesCsv), "utf8"))
  .filter((r) => r.slug)
  .map((r) => ({
    slug: r.slug, name: r.name ?? "", stateSlug: r.stateSlug ?? "", countySlug: r.countySlug ?? "",
    zip: normZip(r.zip ?? ""), status: r.status ?? "", licenseNumber: r.licenseNumber ?? "",
    licenseSource: r.licenseSource ?? "", licenseVerifiedAt: r.licenseVerifiedAt ?? "",
    licenseStatus: r.licenseStatus ?? "", primaryCategorySlug: r.primaryCategorySlug ?? "",
  }));

const outDir = join(root, "data/verification");
mkdirSync(outDir, { recursive: true });

// ---------- --stale N ----------
const staleDays = opt("stale");
if (staleDays) {
  const cutoff = Date.now() - Number(staleDays) * 86400_000;
  const stale = businesses.filter(
    (b) =>
      b.status === "published" &&
      (!b.licenseVerifiedAt || new Date(b.licenseVerifiedAt).getTime() < cutoff),
  );
  writeCsv(join(outDir, "stale.csv"),
    ["slug", "name", "stateSlug", "licenseSource", "licenseVerifiedAt", "daysOld"],
    stale.map((b) => ({
      ...b,
      daysOld: b.licenseVerifiedAt
        ? Math.floor((Date.now() - new Date(b.licenseVerifiedAt).getTime()) / 86400_000)
        : "never",
    })),
  );
  console.log(`stale (> ${staleDays} days): ${stale.length} → data/verification/stale.csv`);
}

// ---------- registry records ----------
interface RegistryRecord { license: string; name: string; zip: string; status: string; expires: string; source: string }
const registry: RegistryRecord[] = [];

if (flag("nyc")) {
  const base =
    "https://data.cityofnewyork.us/resource/w7w3-xahh.json" +
    "?$select=license_nbr,business_name,dba_trade_name,license_status,lic_expir_dd,address_zip" +
    "&$where=business_category%3D%27Home%20Improvement%20Contractor%27&$limit=5000&$offset=";
  let offset = 0;
  for (;;) {
    const res = await fetch(base + offset);
    if (!res.ok) throw new Error(`NYC Open Data ${res.status}`);
    const page: any[] = await res.json();
    for (const r of page) {
      registry.push({
        license: normLicense(r.license_nbr ?? ""),
        name: normName(r.dba_trade_name || r.business_name || ""),
        zip: normZip(r.address_zip ?? ""),
        status: r.license_status ?? "",
        expires: (r.lic_expir_dd ?? "").slice(0, 10),
        source: "NYC DCWP",
      });
      if (r.dba_trade_name && r.business_name)
        registry.push({
          license: normLicense(r.license_nbr ?? ""), name: normName(r.business_name),
          zip: normZip(r.address_zip ?? ""), status: r.license_status ?? "",
          expires: (r.lic_expir_dd ?? "").slice(0, 10), source: "NYC DCWP",
        });
    }
    if (page.length < 5000) break;
    offset += 5000;
  }
  console.log(`NYC DCWP records loaded: ${registry.length}`);
}

const njRoster = opt("nj-roster");
if (njRoster) {
  const colSpec = Object.fromEntries(
    (opt("nj-cols") ?? "license=license_no,name=name,zip=zip,status=status")
      .split(",").map((pair) => pair.split("=") as [string, string]),
  );
  const rows = parseCsv(readFileSync(resolve(njRoster), "utf8"));
  for (const r of rows) {
    registry.push({
      license: normLicense(r[colSpec.license] ?? ""),
      name: normName(r[colSpec.name] ?? ""),
      zip: normZip(r[colSpec.zip] ?? ""),
      status: r[colSpec.status] ?? "",
      expires: r[colSpec.expires ?? "expires"] ?? "",
      source: opt("nj-source") ?? "NJ DCA HIC",
    });
  }
  console.log(`NJ roster records loaded: ${rows.length}`);
}

// ---------- matching ----------
const byLicense = new Map<string, RegistryRecord>();
for (const r of registry) if (r.license) byLicense.set(r.license, r);
const byNameZip = new Map<string, RegistryRecord[]>();
for (const r of registry) {
  const key = `${r.name}|${r.zip}`;
  if (!byNameZip.has(key)) byNameZip.set(key, []);
  byNameZip.get(key)!.push(r);
}

const isActive = (s: string) => /active|current|valid/i.test(s);
const updates: Record<string, unknown>[] = [];
const review: Record<string, unknown>[] = [];
const checklist: Record<string, unknown>[] = [];

const NY_COUNTY_LOOKUPS: Record<string, [string, string]> = {
  "nassau-county": ["Nassau County Office of Consumer Affairs", "https://www.nassaucountyny.gov/1563/Consumer-Affairs"],
  "suffolk-county": ["Suffolk County Labor, Licensing & Consumer Affairs", "https://www.suffolkcountyny.gov/Departments/Labor-Licensing-Consumer-Affairs"],
  "westchester-county": ["Westchester County Consumer Protection", "https://consumer.westchestergov.com/"],
  "rockland-county": ["Rockland County Office of Consumer Protection", "https://rocklandgov.com/departments/consumer-protection/"],
};

for (const b of businesses) {
  if (registry.length > 0) {
    const isNyc = b.stateSlug === "ny" && !NY_COUNTY_LOOKUPS[b.countySlug];
    const applicable = njRoster ? b.stateSlug === "nj" || isNyc : isNyc;
    if (applicable) {
      const exact = b.licenseNumber ? byLicense.get(normLicense(b.licenseNumber)) : undefined;
      if (exact) {
        updates.push({
          slug: b.slug, name: b.name,
          licenseStatus: isActive(exact.status) ? "verified" : "suspended",
          licenseSource: exact.source, licenseVerifiedAt: today,
          registryStatus: exact.status, registryExpires: exact.expires,
          confidence: "exact-license-number", matchedOn: b.licenseNumber,
        });
        continue;
      }
      const candidates = byNameZip.get(`${normName(b.name)}|${b.zip}`) ?? [];
      if (candidates.length > 0) {
        review.push({
          slug: b.slug, name: b.name, zip: b.zip,
          candidateLicense: candidates[0].license, candidateStatus: candidates[0].status,
          candidateExpires: candidates[0].expires, source: candidates[0].source,
          confidence: candidates.length === 1 ? "name-zip-single" : "name-zip-multiple",
          note: "Confirm in the registry before applying — never auto-applied",
        });
        continue;
      }
      review.push({
        slug: b.slug, name: b.name, zip: b.zip, candidateLicense: "", candidateStatus: "",
        candidateExpires: "", source: isNyc ? "NYC DCWP" : "NJ DCA HIC",
        confidence: "no-match", note: "Not found by number or name+zip — verify manually",
      });
      continue;
    }
  }
  // Manual-lookup registries (no bulk feed)
  if (b.stateSlug === "pa") {
    checklist.push({
      slug: b.slug, name: b.name, county: b.countySlug,
      registry: "PA Attorney General HICPA search (do not scrape)",
      lookupUrl: "https://hicsearch.attorneygeneral.gov/",
      record: "HIC number, status, expiration; note: registration is not an endorsement of competency",
    });
  } else if (b.stateSlug === "ny" && NY_COUNTY_LOOKUPS[b.countySlug]) {
    const [office, url] = NY_COUNTY_LOOKUPS[b.countySlug];
    checklist.push({
      slug: b.slug, name: b.name, county: b.countySlug, registry: office, lookupUrl: url,
      record: "License number, status, expiration date",
    });
  } else if (b.stateSlug === "nj" && !njRoster) {
    checklist.push({
      slug: b.slug, name: b.name, county: b.countySlug,
      registry: "NJ DCA license verification (HIC / MyLicense)",
      lookupUrl: "https://newjersey.mylicense.com/verification/",
      record: "Registration/license number, status, expiration date",
    });
  }
}

writeCsv(join(outDir, "license-updates.csv"),
  ["slug","name","licenseStatus","licenseSource","licenseVerifiedAt","registryStatus","registryExpires","confidence","matchedOn"], updates);
writeCsv(join(outDir, "manual-review.csv"),
  ["slug","name","zip","candidateLicense","candidateStatus","candidateExpires","source","confidence","note"], review);
writeCsv(join(outDir, "manual-checklist.csv"),
  ["slug","name","county","registry","lookupUrl","record"], checklist);
console.log(`updates: ${updates.length} · manual review: ${review.length} · manual checklist: ${checklist.length}`);

// ---------- apply ----------
if (flag("apply") && updates.length) {
  const apiKey = process.env.WIX_API_KEY, siteId = process.env.WIX_SITE_ID;
  if (!apiKey || !siteId) {
    console.log("--apply requires WIX_API_KEY/WIX_SITE_ID; use license-updates.csv manually instead.");
    process.exit(0);
  }
  // @ts-expect-error installed where this runs with credentials
  const { createClient, ApiKeyStrategy } = await import("@wix/sdk");
  // @ts-expect-error installed where this runs with credentials
  const { items } = await import("@wix/data");
  const client = createClient({ modules: { items }, auth: ApiKeyStrategy({ apiKey, siteId }) });
  let query = client.items.query("businesses").limit(1000);
  let page = await query.find();
  const bySlug = new Map<string, any>();
  for (;;) {
    for (const item of page.items) if (item.slug) bySlug.set(item.slug, item);
    if (!page.hasNext()) break;
    page = await page.next();
  }
  for (const u of updates) {
    const current = bySlug.get(u.slug as string);
    if (!current) continue;
    await client.items.update("businesses", {
      ...current,
      licenseStatus: u.licenseStatus, licenseSource: u.licenseSource,
      licenseVerifiedAt: u.licenseVerifiedAt, lastVerifiedAt: u.licenseVerifiedAt,
    });
  }
  console.log(`applied ${updates.length} exact-match updates to the CMS`);
}
