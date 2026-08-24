/**
 * Bulk-import the geography seed (states, counties, towns) from data/geo/*.csv
 * into the Wix CMS collections, in ≤1,000-item chunks with retry/backoff.
 *
 * Requirements (see docs/DECISIONS.md — not runnable on a machine without
 * them): WIX_API_KEY (site-scoped API key with Wix Data permissions) and
 * WIX_SITE_ID in the environment, plus `npm i @wix/sdk @wix/data tsx`.
 *
 *   WIX_API_KEY=... WIX_SITE_ID=... npx tsx scripts/import-geo.ts
 *
 * Until an API key exists, the same CSVs are imported through the CMS
 * dashboard's CSV import (which also creates the collections). Either path
 * consumes the same files, so there is one source of truth.
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

const num = (v: string) => (v === "" ? undefined : Number(v));
const bool = (v: string) => v === "true";

const client = createClient({
  modules: { items },
  auth: ApiKeyStrategy({
    apiKey: process.env.WIX_API_KEY!,
    siteId: process.env.WIX_SITE_ID!,
  }),
});

const CHUNK = 1000; // Wix Data bulkInsert hard limit per call

async function bulkInsert(collectionId: string, records: object[]) {
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    for (let attempt = 1; ; attempt++) {
      try {
        await client.items.bulkInsert(collectionId, chunk);
        console.log(`${collectionId}: inserted ${i + chunk.length}/${records.length}`);
        break;
      } catch (err: any) {
        // Back off on rate limits (429 / WDE0014), give up after 5 tries.
        const rateLimited = /429|WDE0014/.test(String(err?.message ?? err));
        if (attempt >= 5 || !rateLimited) throw err;
        const wait = 1000 * 2 ** attempt;
        console.warn(`${collectionId}: rate limited, retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
}

async function main() {
  const states = parseCsv(readFileSync(join(root, "data/geo/states.csv"), "utf8")).map((r) => ({
    ...r,
    sortOrder: num(r.sortOrder),
  }));

  const counties = [
    ...parseCsv(readFileSync(join(root, "data/geo/counties-nj-pa.csv"), "utf8")),
    ...parseCsv(readFileSync(join(root, "data/geo/counties-ny.csv"), "utf8")),
  ].map((r) => ({
    ...r,
    population: num(r.population),
    lat: num(r.lat),
    lng: num(r.lng),
    isLaunch: bool(r.isLaunch),
  }));

  const towns = [
    ...parseCsv(readFileSync(join(root, "data/geo/towns-nj-pa.csv"), "utf8")),
    ...parseCsv(readFileSync(join(root, "data/geo/towns-ny.csv"), "utf8")),
  ].map((r) => ({
    ...r,
    population: num(r.population),
    lat: num(r.lat),
    lng: num(r.lng),
    isLaunch: bool(r.isLaunch),
  }));

  await bulkInsert("states", states);
  await bulkInsert("counties", counties);
  await bulkInsert("towns", towns);
  console.log(`done: ${states.length} states, ${counties.length} counties, ${towns.length} towns`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
