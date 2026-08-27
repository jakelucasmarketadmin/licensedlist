/**
 * Registry seeding (C0) — import "registered, unclaimed" businesses from
 * public license rosters. Public records only, bulk endpoints only (no
 * scraping); every source is documented in docs/REGISTRY.md.
 *
 *   npx tsx scripts/seed-registry.ts --source nyc-hic --county richmond-county --dry-run
 *   npx tsx scripts/seed-registry.ts --source nyc-hic --county richmond-county \
 *       --push https://<preview-origin> --secret <x-seed-secret>
 *
 * Sources:
 *   nyc-hic        NYC Open Data w7w3-xahh ("Issued Licenses", DCWP) filtered
 *                  business_category='Home Improvement Contractor',
 *                  license_status='Active'. NOTE: acd4-wkax is a TRAP — its
 *                  title says "Active Home Improvement Contractor Licenses"
 *                  but it contains the ENTIRE DCWP roster (delis, vendors,
 *                  sidewalk cafés); only w7w3-xahh carries the category column.
 *   ny-re-offices  data.ny.gov nsde-gcv2 (Active Real Estate Offices, NY DOS).
 *                  County-scoped; no expiration in the dataset.
 *
 * Dry-run writes data/registry/{source}-{county}-{date}.csv and prints counts;
 * --push POSTs 200-row batches to the temporary /api/admin-registry endpoint
 * (elevated bulk insert with dedupe by licenseNumber then name+zip).
 */
import { writeFileSync, mkdirSync, appendFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rejectReason, normalizeName } from "../src/lib/registry-normalize";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const source = arg("source") ?? "nyc-hic";
const countyArg = arg("county");
const pushBase = arg("push");
const secret = arg("secret");
const dryRun = args.includes("--dry-run") || !pushBase;

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bLlc\b/g, "LLC").replace(/\bInc\b/g, "Inc.");

interface RegistryRow {
  name: string;
  slug: string;
  status: "registered";
  claimed: "false";
  stateSlug: string;
  countySlug: string;
  townSlug: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  primaryCategorySlug: string;
  categorySlugs: string;
  licenseStatus: "verified";
  licenseNumber: string;
  licenseSource: string;
  licenseVerifiedAt: string;
  licenseExpiresAt: string;
  sourceNotes: string;
  tier: "free";
  isClient: "false";
  address1: string;
}

const today = new Date().toISOString().slice(0, 10);

// NYC borough → geo mapping (borough towns are 1:1 with counties).
const BOROUGHS: Record<string, { countySlug: string; townSlug: string }> = {
  "Brooklyn": { countySlug: "kings-county", townSlug: "brooklyn" },
  "Queens": { countySlug: "queens-county", townSlug: "queens" },
  "Manhattan": { countySlug: "new-york-county", townSlug: "manhattan" },
  "Bronx": { countySlug: "bronx-county", townSlug: "bronx" },
  "Staten Island": { countySlug: "richmond-county", townSlug: "staten-island" },
};
const COUNTY_TO_BOROUGH = Object.fromEntries(
  Object.entries(BOROUGHS).map(([b, v]) => [v.countySlug, b]),
);
// NY DOS county names (upper) → our county slugs, launch counties only.
const NY_DOS_COUNTIES: Record<string, { countySlug: string; townSlug: string }> = {
  "KINGS": BOROUGHS["Brooklyn"],
  "QUEENS": BOROUGHS["Queens"],
  "NEW YORK": BOROUGHS["Manhattan"],
  "BRONX": BOROUGHS["Bronx"],
  "RICHMOND": BOROUGHS["Staten Island"],
};

async function socrataAll(base: string, params: Record<string, string>): Promise<any[]> {
  const out: any[] = [];
  for (let offset = 0; ; offset += 5000) {
    const qs = new URLSearchParams({ ...params, $limit: "5000", $offset: String(offset) });
    const res = await fetch(`${base}?${qs}`);
    if (!res.ok) throw new Error(`Socrata ${res.status}: ${await res.text()}`);
    const page: any[] = await res.json();
    out.push(...page);
    if (page.length < 5000) break;
  }
  return out;
}

async function fetchRows(): Promise<RegistryRow[]> {
  if (source === "nyc-hic") {
    const borough = countyArg ? COUNTY_TO_BOROUGH[countyArg] : undefined;
    if (countyArg && !borough) throw new Error(`unknown NYC county ${countyArg}`);
    const where = [
      "business_category='Home Improvement Contractor'",
      "license_status='Active'",
      borough ? `address_borough='${borough.replace("'", "''")}'` : "address_borough in('Brooklyn','Queens','Manhattan','Bronx','Staten Island')",
    ].join(" AND ");
    const raw = await socrataAll("https://data.cityofnewyork.us/resource/w7w3-xahh.json", { $where: where });
    return raw
      .filter((r) => r.business_name && r.address_borough && BOROUGHS[r.address_borough])
      .map((r) => {
        const geo = BOROUGHS[r.address_borough];
        const name = titleCase(String(r.dba_trade_name || r.business_name));
        return {
          name,
          slug: `reg-${slugify(String(r.license_nbr))}`,
          status: "registered" as const,
          claimed: "false" as const,
          stateSlug: "ny",
          countySlug: geo.countySlug,
          townSlug: geo.townSlug,
          city: titleCase(String(r.address_city ?? r.address_borough)),
          state: "NY",
          zip: String(r.address_zip ?? ""),
          phone: r.contact_phone ? String(r.contact_phone) : "",
          primaryCategorySlug: "general-contractors",
          categorySlugs: "general-contractors",
          licenseStatus: "verified" as const,
          licenseNumber: String(r.license_nbr),
          licenseSource: "NYC DCWP Home Improvement Contractor",
          licenseVerifiedAt: today,
          licenseExpiresAt: r.lic_expir_dd ? String(r.lic_expir_dd).slice(0, 10) : "",
          sourceNotes: `REGISTRY nyc-hic w7w3-xahh ${today}`,
          tier: "free" as const,
          isClient: "false" as const,
          address1: [r.address_building, r.address_street_name].filter(Boolean).join(" "),
        };
      });
  }

  if (source === "ny-re-offices") {
    const rows = countyArg
      ? Object.entries(NY_DOS_COUNTIES).filter(([, v]) => v.countySlug === countyArg)
      : Object.entries(NY_DOS_COUNTIES);
    if (!rows.length) throw new Error(`county ${countyArg} not in NY DOS launch set`);
    const out: RegistryRow[] = [];
    for (const [dosName, geo] of rows) {
      const raw = await socrataAll("https://data.ny.gov/resource/nsde-gcv2.json", {
        $where: `county='${dosName}'`,
      });
      for (const r of raw) {
        if (!r.business_name || !r.license_number) continue;
        out.push({
          name: titleCase(String(r.business_name)),
          slug: `reg-nydos-${slugify(String(r.license_number))}`,
          status: "registered",
          claimed: "false",
          stateSlug: "ny",
          countySlug: geo.countySlug,
          townSlug: geo.townSlug,
          city: titleCase(String(r.business_city ?? "")),
          state: "NY",
          zip: String(r.business_zip ?? ""),
          phone: "",
          primaryCategorySlug: "real-estate-agents",
          categorySlugs: "real-estate-agents",
          licenseStatus: "verified",
          licenseNumber: String(r.license_number),
          licenseSource: "NY DOS Real Estate Principal Office",
          licenseVerifiedAt: today,
          licenseExpiresAt: "",
          sourceNotes: `REGISTRY ny-re-offices nsde-gcv2 ${today}`,
          tier: "free",
          isClient: "false",
          address1: String(r.business_address_1 ?? ""),
        });
      }
    }
    return out;
  }

  throw new Error(`unknown source ${source} (nyc-hic | ny-re-offices)`);
}

const fetched = await fetchRows();
// Name hygiene (R-fix 1): reject junk names, normalize the rest, log rejects.
const rejectsPath = join(root, "data/registry-rejects.csv");
if (!existsSync(rejectsPath))
  writeFileSync(rejectsPath, "date,source,licenseNumber,rawName,reason\n");
let rejected = 0;
const rows = fetched.filter((r) => {
  const reason = rejectReason(r.name);
  if (reason) {
    appendFileSync(rejectsPath, `${today},${source},${r.licenseNumber},"${String(r.name).replace(/"/g, '""')}",${reason}\n`);
    rejected++;
    return false;
  }
  r.name = normalizeName(r.name);
  return true;
});
if (rejected) console.log(`rejected ${rejected} junk name(s) → data/registry-rejects.csv`);

// In-batch dedupe by license number, then normalized name+zip.
const seen = new Set<string>();
const deduped = rows.filter((r) => {
  const k1 = `lic|${r.licenseNumber}`;
  const k2 = `nz|${slugify(r.name)}|${r.zip}`;
  if (seen.has(k1) || seen.has(k2)) return false;
  seen.add(k1);
  seen.add(k2);
  return true;
});
const byCounty = new Map<string, number>();
for (const r of deduped) byCounty.set(r.countySlug, (byCounty.get(r.countySlug) ?? 0) + 1);
console.log(`${source}: fetched ${rows.length}, deduped ${deduped.length}`);
for (const [c, n] of byCounty) console.log(`  ${c}: ${n}`);

mkdirSync(join(root, "data/registry"), { recursive: true });
const csvPath = join(root, `data/registry/${source}-${countyArg ?? "all"}-${today}.csv`);
const header = Object.keys(deduped[0] ?? { name: "" });
const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
writeFileSync(csvPath, [header.join(","), ...deduped.map((r) => header.map((h) => esc((r as any)[h])).join(","))].join("\n") + "\n");
console.log(`written ${csvPath}`);

if (dryRun) {
  console.log("dry-run — no push. Add --push <origin> --secret <secret> to ingest.");
  process.exit(0);
}

// Push in batches to the temporary admin-registry endpoint.
let pushed = 0;
for (let i = 0; i < deduped.length; i += 200) {
  const batch = deduped.slice(i, i + 200);
  const res = await fetch(`${pushBase}/api/admin-registry`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-seed-secret": secret ?? "" },
    body: JSON.stringify({ step: "ingest", rows: batch }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(`batch ${i}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  pushed += body.inserted ?? 0;
  console.log(`batch ${i / 200 + 1}: inserted ${body.inserted}, skipped ${body.skipped} (total ${pushed})`);
}
console.log(`DONE: ${pushed} registered rows ingested`);
