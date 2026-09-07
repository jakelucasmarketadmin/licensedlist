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

const HDR = ["townSlug","stateSlug","geoid","geoName","totalUnits","medianYearBuilt","pctPre1940","pctPre1960","pctOwnerOccupied","erasJson","release","fetchedAt"];
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
/** Same normalisation on both sides: the index strips the legal suffix, so the
 * lookup must too, or "Washington Township" never matches "Washington". */
const bareName = (n: string) =>
  n.replace(/\s+(borough|township|town|city|village|CDP)$/i, "").toLowerCase();

const gazIndex = new Map<string, { geoid: string; name: string }>();
const loadedStates = new Set<string>();

/**
 * Town names repeat across counties in all three states — New Jersey alone has
 * several "Washington township". Keying on name only silently dropped them, so
 * the index is keyed by state|county|name, resolved through the county
 * gazetteer (county subdivision GEOID = state(2) + county(3) + cousub(5)).
 */
function loadGazetteer(stateSlug: string) {
  const fips = STATE_FIPS[stateSlug];
  const countyFile = join(root, `data/money/gaz/gaz_counties_${fips}.txt`);
  const cousubFile = join(root, `data/money/gaz/gaz_cousubs_${fips}.txt`);
  for (const f of [countyFile, cousubFile]) {
    if (!existsSync(f)) throw new Error(`missing gazetteer ${f} — see docs/RUNBOOK.md §16`);
  }
  // county FIPS (5 digits) -> county slug, e.g. 34003 -> "bergen-county"
  const countySlugByFips = new Map<string, string>();
  for (const line of readFileSync(countyFile, "utf8").split("\n").slice(1)) {
    const cells = line.split("\t");
    if (cells.length < 4) continue;
    const geoid = cells[1]?.trim();
    const name = cells[3]?.trim();
    if (!geoid || !name) continue;
    countySlugByFips.set(geoid, name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""));
  }
  for (const line of readFileSync(cousubFile, "utf8").split("\n").slice(1)) {
    const cells = line.split("\t");
    if (cells.length < 4) continue;
    const geoid = cells[1]?.trim();
    const name = cells[3]?.trim();
    if (!geoid || !name) continue;
    const countySlug = countySlugByFips.get(geoid.slice(0, 5));
    if (!countySlug) continue;
    gazIndex.set(`${stateSlug}|${countySlug}|${bareName(name)}`, { geoid: `06000US${geoid}`, name });
  }
  // Census-designated places (Blue Bell, Harleysville, Willow Grove…) are not
  // county subdivisions, so they only exist in the place gazetteer. Indexed
  // without a county key and consulted only when the cousub lookup misses.
  const placeFile = join(root, `data/money/gaz/gaz_place_${fips}.txt`);
  if (existsSync(placeFile)) {
    for (const line of readFileSync(placeFile, "utf8").split("\n").slice(1)) {
      const cells = line.split("\t");
      if (cells.length < 4) continue;
      const geoid = cells[1]?.trim();
      const name = cells[3]?.trim();
      if (!geoid || !name) continue;
      const key = `${stateSlug}|place|${bareName(name)}`;
      if (!gazIndex.has(key)) gazIndex.set(key, { geoid: `16000US${geoid}`, name });
    }
  }
  loadedStates.add(stateSlug);
}

function geoidFor(name: string, stateSlug: string, countySlug: string): { geoid: string; name: string } | null {
  if (!loadedStates.has(stateSlug)) loadGazetteer(stateSlug);
  return (
    gazIndex.get(`${stateSlug}|${countySlug}|${bareName(name)}`) ??
    gazIndex.get(`${stateSlug}|place|${bareName(name)}`) ??
    null
  );
}

async function housingFor(geoid: string) {
  const url = `https://api.censusreporter.org/1.0/data/show/latest?table_ids=B25034,B25035,B25003&geo_ids=${geoid}`;
  // Census Reporter rejects the default Node user-agent, so identify ourselves.
  const res = await fetch(url, {
    headers: { "User-Agent": "LicensedList/1.0 (local directory; admin@tier201.com)", Accept: "application/json" },
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
  // Full B25034 distribution, oldest first — rendered as a sourced table.
  const ERAS: [string, string][] = [
    ["B25034011", "1939 or earlier"], ["B25034010", "1940–1949"], ["B25034009", "1950–1959"],
    ["B25034008", "1960–1969"], ["B25034007", "1970–1979"], ["B25034006", "1980–1989"],
    ["B25034005", "1990–1999"], ["B25034004", "2000–2009"], ["B25034003", "2010–2019"],
    ["B25034002", "2020 or later"],
  ];
  const eras = ERAS.map(([k, label]) => ({
    label,
    units: Number(b34[k] || 0),
    pct: +((Number(b34[k] || 0) / total) * 100).toFixed(1),
  }));
  return {
    totalUnits: total,
    medianYearBuilt: Number(d.B25035?.estimate?.B25035001 || 0) || "",
    pctPre1940: +(pre1940 / total * 100).toFixed(1),
    pctPre1960: +(pre1960 / total * 100).toFixed(1),
    pctOwnerOccupied: occ ? +(owner / occ * 100).toFixed(1) : "",
    erasJson: JSON.stringify(eras),
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
  const geo = geoidFor(t.name, t.stateSlug, t.countySlug);
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
