/**
 * Seed the categorygroups and categories collections from data/taxonomy/*.csv.
 * Same requirements and usage as scripts/import-geo.ts:
 *
 *   WIX_API_KEY=... WIX_SITE_ID=... npx tsx scripts/seed-categories.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error installed only where this script runs
import { createClient, ApiKeyStrategy } from "@wix/sdk";
// @ts-expect-error installed only where this script runs
import { items } from "@wix/data";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const client = createClient({
  modules: { items },
  auth: ApiKeyStrategy({
    apiKey: process.env.WIX_API_KEY!,
    siteId: process.env.WIX_SITE_ID!,
  }),
});

async function main() {
  const groups = parseCsv(readFileSync(join(root, "data/taxonomy/categorygroups.csv"), "utf8")).map(
    (r) => ({ ...r, sortOrder: Number(r.sortOrder) }),
  );
  const categories = parseCsv(readFileSync(join(root, "data/taxonomy/categories.csv"), "utf8")).map(
    (r) => ({
      ...r,
      licenseRequired: r.licenseRequired === "true",
      sortOrder: Number(r.sortOrder),
    }),
  );

  // Both well under the 1,000-item bulkInsert limit.
  await client.items.bulkInsert("categorygroups", groups);
  await client.items.bulkInsert("categories", categories);
  console.log(`done: ${groups.length} groups, ${categories.length} categories`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
