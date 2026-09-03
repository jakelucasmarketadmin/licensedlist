/**
 * Pull housing-age and tenure facts per town from the Census Reporter API
 * (ACS 5-year, no API key) into data/money/town-housing.csv.
 *
 *   npx tsx scripts/fetch-town-housing.ts [--state nj] [--county bergen-county]
 *
 * Every figure the Local context block renders comes from here, so the block
 * is sourced by construction — there is no hand-written housing prose.
 * Census Reporter geoids: places are 16000US{placefips}, county subdivisions
 * 06000US{...}. We resolve each town by name search, then store the geoid so
 * re-runs are stable and auditable.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOWN_SEED } from "../src/data/geo.generated.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "data/money/town-housing.csv");
const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const onlyState = arg("state");
const onlyCounty = arg("county");

const HDR = ["townSlug","stateSlug","geoid","geoName","totalUnits","medianYearBuilt","pctPre1940","pctPre1960","pctOwnerOccupied","release","fetchedAt"];
const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

const existing = new Map<string, Record<string, string>>();
if (existsSync(OUT)) {
  const [h, ...rows] = readFileSync(OUT, "utf8").trim().split("\n");
  const cols = h.split(",");
  for (const r of rows) {
    const cells = r.match(/("([^"]|"")*"|[^,]*)/g)?.filter((_, i) => i % 2 === 0) ?? [];
    const rec = Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? "").replace(/^"|"$/g, "").replace(/""/g, '"')]));
    existing.set(`${rec.stateSlug}|${rec.townSlug}`, rec as Record<string, string>);
  }
}

const STATE_FIPS: Record<string, string> = { nj: "34", ny: "36", pa: "42" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Census Reporter's /geo/search endpoint blocks scripted access, so town →
 * GEOID resolution comes from the Census county-subdivision gazetteer instead
 * (public flat files, no key). NJ/NY/PA towns are county subdivisions, which
 * is Census Reporter summary level 060 → geoid "06000US{GEOID}".
 * Files: scripts/../data/money/gaz/gaz_cousubs_{fips}.txt
 */
const gazIndex = new Map<string, { geoid: string; name: string }>();
function loadGazetteer(stateSlug: string) {
  const fips = STATE_FIPS[stateSlug];
  const file = join(root, `data/money/gaz/gaz_cousubs_${fips}.txt`);
  if (!existsSync(file)) throw new Error(`missing gazetteer ${file} — see docs/RUNBOOK.md`);
  for (const line of readFileSync(file, "utf8").split("\n").slice(1)) {
    const cells = line.split("\t");
    if (cells.length < 4) continue;
    const geoid = cells[1]?.trim();
    const name = cells[3]?.trim();
    if (!geoid || !name) continue;
    // "Westwood borough" / "Washington township" → match on the bare name too.
    const bare = name.replace(/\s+(borough|township|town|city|village|CDP)$/i, "").toLowerCase();
    gazIndex.set(`${stateSlug}|${bare}`, { geoid: `06000US${geoid}`, name });
  }
}

function geoidFor(name: string, stateSlug: string): { geoid: string; name: string } | null {
  if (![...gazIndex.keys()].some((k) => k.startsWith(`${stateSlug}|`))) loadGazetteer(stateSlug);
  const key = `${stateSlug}|${name.toLowerCase()}`;
  return gazIndex.get(key) ?? null;
}

async function housingFor(geoid: string) {
  const url = `https://api.censusreporter.org/1.0/data/show/latest?table_ids=B25034,B25035,B25003&geo_ids=${geoid}`;
  // Census Reporter rejects the default Node user-agent, so identify ourselves.
  const res = await fetch(url, {
    headers: { "User-Agent": "TriVetted/1.0 (local directory; admin@tier201.com)", Accept: "application/json" },
  }).catch(() => null);
  if (!res?.ok) return null;
  const body: any = await res.json().catch(() => null);
  const d = body?.data?.[geoid];
  if (!d) return null;
  const b34 = d.B25034?.estimate ?? {};
  const total = Number(b34.B25034001 || 0);
  if (!total) return null;
  const pre1940 = Number(b34.B25034011 || 0);
  const pre1960 = pre1940 + Number(b34.B25034010 || 0) + Number(b34.B25034009 || 0);
  const occ = Number(d.B25003?.estimate?.B25003001 || 0);
  const owner = Number(d.B25003?.estimate?.B25003002 || 0);
  return {
    totalUnits: total,
    medianYearBuilt: Number(d.B25035?.estimate?.B25035001 || 0) || "",
    pctPre1940: +(pre1940 / total * 100).toFixed(1),
    pctPre1960: +(pre1960 / total * 100).toFixed(1),
    pctOwnerOccupied: occ ? +(owner / occ * 100).toFixed(1) : "",
    release: body?.release?.name ?? "",
  };
}

const towns = TOWN_SEED.filter((t: any) =>
  (!onlyState || t.stateSlug === onlyState) && (!onlyCounty || t.countySlug === onlyCounty));
console.log(`resolving ${towns.length} town(s)…`);

const today = new Date().toISOString().slice(0, 10);
let added = 0, skipped = 0, failed: string[] = [];
for (const t of towns as any[]) {
  const key = `${t.stateSlug}|${t.slug}`;
  if (existing.has(key)) { skipped++; continue; }
  const geo = geoidFor(t.name, t.stateSlug);
  if (!geo) { failed.push(`${t.name} (no geoid)`); await sleep(250); continue; }
  const h = await housingFor(geo.geoid);
  if (!h) { failed.push(`${t.name} (geoid ${geo.geoid}: no data)`); await sleep(250); continue; }
  existing.set(key, { townSlug: t.slug, stateSlug: t.stateSlug, geoid: geo.geoid, geoName: geo.name, ...h, fetchedAt: today } as any);
  added++;
  await sleep(250);
}

const rows = [...existing.values()];
writeFileSync(OUT, [HDR.join(","), ...rows.map((r) => HDR.map((h) => esc((r as any)[h])).join(","))].join("\n") + "\n");
console.log(`${added} added, ${skipped} already present, ${failed.length} unresolved${failed.length ? ": " + failed.join(", ") : ""}`);
console.log(`-> data/money/town-housing.csv (${rows.length} rows)`);
