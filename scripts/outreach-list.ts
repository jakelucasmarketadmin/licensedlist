/**
 * Outreach target list: for each launch county × top-12 category, how many
 * more published businesses are needed to reach the 3-listing publishing
 * threshold (i.e., to take that county×category page live).
 *
 *   npx tsx scripts/outreach-list.ts [--businesses <export.csv>]
 *
 * Without --businesses (or before any import), every slot needs 3. With a
 * Businesses export, published listings are counted per county×category.
 * Output: data/outreach-targets.csv sorted by fewest-needed first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTY_SEED, TOWN_SEED } from "../src/data/geo.generated.ts";
import { CATEGORY_SEED } from "../src/data/taxonomy.generated.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const bizArg = args[args.indexOf("--businesses") + 1];
const bizPath = args.includes("--businesses") ? (isAbsolute(bizArg) ? bizArg : join(root, bizArg)) : null;

const TOP_12 = [
  "roofers", "plumbers", "electricians", "hvac-contractors", "general-contractors",
  "landscapers", "painters", "movers", "pest-control", "tree-services", "auto-repair", "dentists",
];

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
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const businesses = bizPath ? parseCsv(readFileSync(bizPath, "utf8")).filter((b) => b.status === "published") : [];
const townsByCounty = new Map<string, Set<string>>();
for (const t of TOWN_SEED) {
  const key = `${t.stateSlug}|${t.countySlug}`;
  if (!townsByCounty.has(key)) townsByCounty.set(key, new Set());
  townsByCounty.get(key)!.add(t.slug);
}

const rows: Record<string, unknown>[] = [];
for (const county of COUNTY_SEED) {
  const townSlugs = townsByCounty.get(`${county.stateSlug}|${county.slug}`) ?? new Set();
  for (const catSlug of TOP_12) {
    const category = CATEGORY_SEED.find((c) => c.slug === catSlug);
    if (!category) continue;
    const published = businesses.filter((b) => {
      if (b.stateSlug !== county.stateSlug) return false;
      const cats = new Set((b.categorySlugs ?? "").split(",").map((s) => s.trim()));
      if (b.primaryCategorySlug) cats.add(b.primaryCategorySlug);
      if (!cats.has(catSlug)) return false;
      const serves = (b.serviceTownSlugs ?? "").split(",").map((s) => s.trim());
      return b.countySlug === county.slug || serves.some((t) => townSlugs.has(t));
    }).length;
    const needed = Math.max(0, 3 - published);
    rows.push({
      state: county.stateSlug,
      county: county.slug,
      countyName: county.name,
      category: catSlug,
      categoryName: category.name,
      licenseRequired: category.licenseRequired,
      published,
      neededToGoLive: needed,
      targetPage: `/${county.pathKey}/${catSlug}`,
    });
  }
}
rows.sort((a, b) => (a.neededToGoLive as number) - (b.neededToGoLive as number) || String(a.county).localeCompare(String(b.county)));

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = ["state","county","countyName","category","categoryName","licenseRequired","published","neededToGoLive","targetPage"];
writeFileSync(
  join(root, "data/outreach-targets.csv"),
  [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h])).join(","))].join("\n") + "\n",
);
const live = rows.filter((r) => r.neededToGoLive === 0).length;
console.log(`slots: ${rows.length} (22 counties × top-12) · already live: ${live} · written to data/outreach-targets.csv`);
