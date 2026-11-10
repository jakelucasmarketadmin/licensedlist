/**
 * Fills the local D1 database from the CSVs already in this repo, so the site
 * can run on this computer before the real Wix export is loaded.
 *
 *   npm run db:migrate:local
 *   npm run db:seed:local            (add --remote to fill the Cloudflare database)
 *
 * What it loads: geo and taxonomy (data/import), guides, the last businesses
 * backup (backups/), the DEMO preview records, client listings from
 * data/businesses-merge.csv, and the registry rosters
 * (data/registry). It replaces those collections each run and leaves
 * everything else (claims, leads, reviews…) alone.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.argv.includes("--remote");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
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

// Wix stored most fields as text ("true", "4.8"); only these were typed.
const NUMBERS = new Set(["lat", "lng", "population", "sortOrder"]);
const BOOLEANS = new Set(["licenseRequired", "isLaunch", "ghlSynced"]);
// Wix export headers for the system fields.
const SYSTEM = { ID: "_id", "Created Date": "_createdDate", "Updated Date": "_updatedDate", Owner: "_owner" };

function toItem(row) {
  const item = {};
  for (const [k, raw] of Object.entries(row)) {
    if (raw === "") continue;
    const key = SYSTEM[k] ?? k;
    // The backup also carries the old Vibe display columns ("Business Name"…); keep field keys only.
    if (!SYSTEM[k] && /\s/.test(k)) continue;
    item[key] = NUMBERS.has(key) && Number.isFinite(Number(raw)) ? Number(raw) : BOOLEANS.has(key) ? raw === "true" : raw;
  }
  item._id ||= item.slug || crypto.randomUUID();
  return item;
}

const read = (rel) => parseCsv(readFileSync(join(root, rel), "utf8"));
const collections = {
  states: read("data/import/states.csv"),
  counties: read("data/import/counties.csv"),
  towns: read("data/import/towns.csv"),
  categorygroups: read("data/import/categorygroups.csv"),
  categories: read("data/import/categories.csv"),
  guides: read("data/import/guides.csv"),
  businesses: [
    ...read("backups/businesses-2026-08-24.csv"),
    ...read("data/import/businesses-demo.csv"),
    // Client listings, as the repo's importer shapes them (npx tsx scripts/import-businesses.ts data/clients-import.csv --dry-run).
    ...(existsSync(join(root, "data/businesses-merge.csv")) ? read("data/businesses-merge.csv") : []),
    ...readdirSync(join(root, "data/registry")).filter((f) => f.endsWith(".csv")).flatMap((f) => read(`data/registry/${f}`)),
  ],
};

const q = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const lines = [];
const counts = {};
for (const [name, rows] of Object.entries(collections)) {
  lines.push(`DELETE FROM items WHERE collection = ${q(name)};`);
  const seen = new Set();
  for (const row of rows) {
    const item = toItem(row);
    // Records without a slug are the old Vibe demo rows every query skips anyway.
    if (name === "businesses" && !item.slug) continue;
    const key = item.slug || item._id;
    if (seen.has(key)) continue;
    seen.add(key);
    item._id = name === "businesses" ? item.slug : item._id;
    const created = item._createdDate || "2026-08-24T00:00:00.000Z";
    lines.push(`INSERT INTO items (collection, id, data, created, updated) VALUES (${q(name)}, ${q(item._id)}, ${q(JSON.stringify(item))}, ${q(created)}, ${q(created)});`);
  }
  counts[name] = seen.size;
}

mkdirSync(join(root, ".wrangler"), { recursive: true });
const file = join(root, ".wrangler", "seed.sql");
writeFileSync(file, lines.join("\n") + "\n");
console.log("Rows:", counts);
execFileSync("npx", ["wrangler", "d1", "execute", "licensedlist", remote ? "--remote" : "--local", "--file", file, "--yes"], { cwd: root, stdio: "inherit", shell: true });
