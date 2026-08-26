// Generate src/data/*.generated.ts from the CSV seed files in data/.
// Plain Node (no deps) so it runs even though this repo can't npm install
// (private @wix registry). The CSVs are the single source of truth for
// geography + taxonomy: this generator feeds the site's TS modules, and the
// same CSVs are imported into the Wix CMS collections (see docs/DECISIONS.md).
//
// Usage: node scripts/generate-data-modules.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal RFC 4180 CSV parser. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const readCsv = (rel) => parseCsv(readFileSync(join(root, rel), 'utf8'));

const num = (v) => (v === '' || v === undefined ? undefined : Number(v));
const bool = (v) => v === 'true';
const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

// ---- Load ----
const states = readCsv('data/geo/states.csv').map((r) => ({
  name: r.name, slug: r.slug, abbr: r.abbr, intro: r.intro,
  licensingNotes: r.licensingNotes, sortOrder: num(r.sortOrder),
}));

const counties = [
  ...readCsv('data/geo/counties-nj-pa.csv'),
  ...readCsv('data/geo/counties-ny.csv'),
].map((r) => ({
  name: r.name, slug: r.slug, stateSlug: r.stateSlug, pathKey: r.pathKey,
  population: num(r.population), intro: r.intro, permitNotes: r.permitNotes,
  lat: num(r.lat), lng: num(r.lng), isLaunch: bool(r.isLaunch),
}));

const towns = [
  ...readCsv('data/geo/towns-nj-pa.csv'),
  ...readCsv('data/geo/towns-ny.csv'),
].map((r) => ({
  name: r.name, slug: r.slug, countySlug: r.countySlug, stateSlug: r.stateSlug,
  pathKey: r.pathKey, population: num(r.population), intro: r.intro,
  localFacts: JSON.parse(r.localFacts || '[]'),
  zips: list(r.zips), lat: num(r.lat), lng: num(r.lng),
  nearbySlugs: list(r.nearbySlugs), isLaunch: bool(r.isLaunch),
}));

const categoryGroups = readCsv('data/taxonomy/categorygroups.csv').map((r) => ({
  name: r.name, slug: r.slug, sortOrder: num(r.sortOrder), icon: r.icon,
}));

let guides = [];
try {
  guides = [
    ...readCsv('data/guides/guides-geo.csv'),
    ...readCsv('data/guides/guides-categories.csv'),
  ].map((r) => ({
    slug: r.slug, title: r.title, scope: r.scope, scopeKey: r.scopeKey, body: r.body,
    author: r.author, aiAssisted: r.aiAssisted === 'true',
    publishedAt: r.publishedAt, updatedAt: r.updatedAt,
  }));
} catch { /* guides are optional until the CSVs exist */ }

const categories = readCsv('data/taxonomy/categories.csv').map((r) => ({
  name: r.name, slug: r.slug, groupSlug: r.groupSlug, schemaType: r.schemaType,
  licenseRequired: bool(r.licenseRequired),
  licenseSourcesByState: JSON.parse(r.licenseSourcesByState || '{}'),
  synonyms: list(r.synonyms), sortOrder: num(r.sortOrder),
}));

// ---- Validate ----
const fail = (msg) => { console.error('VALIDATION FAILED:', msg); process.exit(1); };
// Slugs are unique PER STATE (nj/roxbury and ny/roxbury may coexist;
// pa/delaware-county and ny/delaware-county may coexist). pathKeys stay
// globally unique.
const stateSlugs = new Set(states.map((s) => s.slug));
const countyKeys = new Set(counties.map((c) => `${c.stateSlug}|${c.slug}`));
const townKeys = new Set(towns.map((t) => `${t.stateSlug}|${t.slug}`));
const groupSlugs = new Set(categoryGroups.map((g) => g.slug));
if (countyKeys.size !== counties.length) fail('duplicate county slug within a state');
if (townKeys.size !== towns.length) fail('duplicate town slug within a state');
if (new Set(towns.map((t) => t.pathKey)).size !== towns.length) fail('duplicate town pathKeys');
for (const c of counties) if (!stateSlugs.has(c.stateSlug)) fail(`county ${c.slug} bad state`);
for (const t of towns) {
  if (!countyKeys.has(`${t.stateSlug}|${t.countySlug}`)) fail(`town ${t.slug} bad county ${t.countySlug}`);
  if (t.pathKey !== `${t.stateSlug}/${t.countySlug}/${t.slug}`) fail(`town ${t.slug} bad pathKey`);
  for (const n of t.nearbySlugs) if (!townKeys.has(`${t.stateSlug}|${n}`)) fail(`town ${t.slug} bad nearby ${n} (must exist in ${t.stateSlug})`);
  if (!Array.isArray(t.localFacts) || t.localFacts.length < 3) fail(`town ${t.slug} needs 3 localFacts`);
}
for (const c of categories) if (!groupSlugs.has(c.groupSlug)) fail(`category ${c.slug} bad group`);

// ---- Emit ----
mkdirSync(join(root, 'src/data'), { recursive: true });
const banner = `// AUTO-GENERATED by scripts/generate-data-modules.mjs — do not edit by hand.\n// Source of truth: data/geo/*.csv and data/taxonomy/*.csv (edit those, re-run the script).\n`;

writeFileSync(
  join(root, 'src/data/geo.generated.ts'),
  `${banner}
export interface StateSeed { name: string; slug: string; abbr: string; intro: string; licensingNotes: string; sortOrder?: number }
export interface CountySeed { name: string; slug: string; stateSlug: string; pathKey: string; population?: number; intro: string; permitNotes: string; lat?: number; lng?: number; isLaunch: boolean }
export interface TownSeed { name: string; slug: string; countySlug: string; stateSlug: string; pathKey: string; population?: number; intro: string; localFacts: string[]; zips: string[]; lat?: number; lng?: number; nearbySlugs: string[]; isLaunch: boolean }

export const STATE_SEED: StateSeed[] = ${JSON.stringify(states, null, 2)};

export const COUNTY_SEED: CountySeed[] = ${JSON.stringify(counties, null, 2)};

export const TOWN_SEED: TownSeed[] = ${JSON.stringify(towns, null, 2)};
`,
);

writeFileSync(
  join(root, 'src/data/taxonomy.generated.ts'),
  `${banner}
export interface CategoryGroupSeed { name: string; slug: string; sortOrder?: number; icon: string }
export interface CategorySeed { name: string; slug: string; groupSlug: string; schemaType: string; licenseRequired: boolean; licenseSourcesByState: Record<string, string>; synonyms: string[]; sortOrder?: number }

export const CATEGORY_GROUP_SEED: CategoryGroupSeed[] = ${JSON.stringify(categoryGroups, null, 2)};

export const CATEGORY_SEED: CategorySeed[] = ${JSON.stringify(categories, null, 2)};
`,
);

// Guides validation + emit
if (guides.length) {
  const guideSlugs = new Set();
  for (const g of guides) {
    if (guideSlugs.has(g.slug)) fail(`duplicate guide slug ${g.slug}`);
    guideSlugs.add(g.slug);
    if (!g.body.includes('Sources:')) fail(`guide ${g.slug} missing sources block`);
    if (g.scope === 'state' && !stateSlugs.has(g.scopeKey)) fail(`guide ${g.slug} bad state scopeKey`);
    if (g.scope === 'category' && !categories.some((c) => c.slug === g.scopeKey)) fail(`guide ${g.slug} bad category scopeKey`);
    if (g.scope === 'county' && !counties.some((c) => c.pathKey === g.scopeKey)) fail(`guide ${g.slug} bad county scopeKey`);
  }
  writeFileSync(
    join(root, 'src/data/guides.generated.ts'),
    `${banner}
export interface GuideSeed { slug: string; title: string; scope: string; scopeKey: string; body: string; author: string; aiAssisted: boolean; publishedAt: string; updatedAt: string }

export const GUIDE_SEED: GuideSeed[] = ${JSON.stringify(guides, null, 2)};
`,
  );
  // merged CSV for the CMS dashboard importer (guides collection)
  const NEEDS_QUOTES = new RegExp('[",\\n\\r]');
  const esc = (v) => { const s = String(v ?? ''); return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const header = ['slug','title','scope','scopeKey','body','author','aiAssisted','publishedAt','updatedAt'];
  writeFileSync(
    join(root, 'data/import/guides.csv'),
    [header.join(','), ...guides.map((g) => header.map((h) => esc(g[h])).join(','))].join(String.fromCharCode(10)) + String.fromCharCode(10),
  );
}


// ---- town photos (optional file; module regenerates when present) ----
{
  const photosPath = join(root, 'data/geo/town-photos.csv');
  if (existsSync(photosPath)) {
    const photos = parseCsv(readFileSync(photosPath, 'utf8')).filter((p) => p.url);
    for (const p of photos) {
      if (!['county', 'town'].includes(p.scope)) fail(`town-photo bad scope ${p.scope}`);
      if (!stateSlugs.has(p.stateSlug)) fail(`town-photo bad state ${p.stateSlug}`);
      if (!counties.some((c) => c.stateSlug === p.stateSlug && c.slug === p.countySlug))
        fail(`town-photo bad county ${p.stateSlug}/${p.countySlug}`);
      if (p.scope === 'town' && !towns.some((t) => t.stateSlug === p.stateSlug && t.slug === p.townSlug))
        fail(`town-photo bad town ${p.stateSlug}/${p.townSlug}`);
      if (!/^https:\/\/upload\.wikimedia\.org\//.test(p.url)) fail(`town-photo non-Commons url ${p.url}`);
      if (!p.license || !p.author || !p.sourceUrl) fail(`town-photo ${p.url} missing credit fields`);
    }
    writeFileSync(
      join(root, 'src/data/town-photos.generated.ts'),
      `${banner}
export interface TownPhotoSeed {
  scope: "county" | "town";
  stateSlug: string;
  countySlug: string;
  townSlug: string;
  url: string;
  author: string;
  license: string;
  sourceUrl: string;
  caption: string;
  alt: string;
  focalX: string;
  focalY: string;
  preferred: string;
}

export const TOWN_PHOTO_SEED: TownPhotoSeed[] = ${JSON.stringify(photos, null, 2)};
`,
    );
    console.log(`town photos: ${photos.length}`);
  }
}

console.log(
  `generated: ${states.length} states, ${counties.length} counties, ${towns.length} towns, ` +
  `${categoryGroups.length} groups, ${categories.length} categories, ${guides.length} guides`,
);
