/**
 * Listing badges a business shows on its OWN website, linking back to its
 * LicensedList profile.
 *
 *   node scripts/listing-badge.mjs            # every row in data/badges.csv
 *   node scripts/listing-badge.mjs --slug hofmeister-plumbing
 *
 * Input: data/badges.csv (slug,name,variant,registry,checkedAt,website)
 *   variant = verified → green-shield "License verified" badge naming the
 *             registry and the check month. Refused unless registry + checkedAt
 *             are present and the check is ≤365 days old (same freshness rule
 *             as TrustBadge.astro). Only for licenseStatus = verified listings —
 *             never credential-only or not-required.
 *   variant = listed   → neutral "Listed on LicensedList" badge (no license
 *             claim). Use for not-required categories and credential-only.
 *
 * Output:
 *   public/assets/badges/{slug}.svg (+ public/public hedge copy, same as awards)
 *   docs/outreach/badges/{slug}.html — the install snippet + schema line
 *
 * Rules (see docs/BADGES.md): plain <a><img> only, branded alt text, never
 * keyword anchors, never JavaScript embeds, never a condition of listing.
 * Re-run after every verify-licenses pass so the check month stays current.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://www.licensedlist.com";
const args = process.argv.slice(2);
const onlySlug = (() => { const i = args.indexOf("--slug"); return i >= 0 ? args[i + 1] : undefined; })();

// Minimal CSV parser (quoted fields, commas inside quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v !== "")) rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const monthYear = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

const SHIELD = `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`;

function badgeSvg({ variant, registry, checkedAt }) {
  const verified = variant === "verified";
  const kicker = verified ? `LICENSE VERIFIED · ${monthYear(checkedAt).toUpperCase()}` : "LISTED ON";
  const detail = verified ? `Registry: ${registry}` : "Local pros · NJ · NY · PA";
  const detailSize = detail.length > 38 ? 9.5 : detail.length > 32 ? 10.5 : 11.5;
  const label = verified
    ? `License verified on LicensedList: ${registry}, checked ${monthYear(checkedAt)}`
    : "Listed on LicensedList";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="72" viewBox="0 0 280 72" role="img" aria-label="${esc(label)}">
  <rect x="1" y="1" width="278" height="70" rx="10" fill="#0f3a5c" stroke="#fffdf8" stroke-width="2"/>
  <g transform="translate(14 14) scale(1.8)" fill="${verified ? "#1f8a4c" : "#e6eef5"}" stroke="#fffdf8" stroke-width="1.4" stroke-linejoin="round">
    ${SHIELD}
    ${verified ? `<path d="m9 12 2 2 4-4" fill="none" stroke="#fffdf8" stroke-width="2" stroke-linecap="round"/>` : ""}
  </g>
  <text x="70" y="24" font-family="Helvetica, Arial, sans-serif" font-size="9.5" font-weight="700" letter-spacing="1.1" fill="${verified ? "#8fe0b0" : "#e6eef5"}">${kicker}</text>
  <text x="70" y="45" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="700" fill="#fffdf8">LicensedList</text>
  <text x="70" y="61" font-family="Helvetica, Arial, sans-serif" font-size="${detailSize}" fill="#e6eef5">${esc(detail)}</text>
</svg>
`;
}

function snippet(b) {
  const profile = `${ORIGIN}/business/${b.slug}`;
  const img = `${ORIGIN}/assets/badges/${b.slug}.svg`;
  const verified = b.variant === "verified";
  const alt = verified
    ? `License verified on LicensedList (${b.registry}, checked ${monthYear(b.checkedAt)})`
    : "Listed on LicensedList";
  const title = verified
    ? `See our license record on LicensedList, checked against ${b.registry}` +
      (/PA AG|HICPA|Attorney General/i.test(b.registry)
        ? ". PA Attorney General: registration is not an endorsement of competency."
        : "")
    : "See our profile on LicensedList";
  return `<!-- LicensedList badge for ${b.name}. Generated by scripts/listing-badge.mjs — do not hand-edit. -->

<!-- 1. Badge: paste once in the trust/reviews section and once on About or Contact.
        Must be in server-rendered HTML (not a JS-only component). No keyword anchor text. -->
<a href="${profile}" target="_blank" rel="noopener" title="${esc(title)}">
  <img src="${img}" width="280" height="72" alt="${esc(alt)}" loading="lazy" decoding="async">
</a>

<!-- 2. Schema: add this URL to the "sameAs" array of the site's existing
        LocalBusiness / Organization JSON-LD in <head>. -->
"sameAs": ["${profile}"]
`;
}

const all = parseCsv(readFileSync(join(root, "data/badges.csv"), "utf8"));
const rows = onlySlug ? all.filter((r) => r.slug === onlySlug) : all;
if (!rows.length) { console.error(`No rows${onlySlug ? ` for --slug ${onlySlug}` : ""}`); process.exit(1); }

for (const dir of ["public/assets/badges", "public/public/assets/badges", "docs/outreach/badges"]) {
  mkdirSync(join(root, dir), { recursive: true });
}

let failed = 0;
for (const b of rows) {
  if (!["verified", "listed"].includes(b.variant)) { console.error(`✗ ${b.slug}: unknown variant "${b.variant}"`); failed++; continue; }
  if (b.variant === "verified") {
    const age = (Date.now() - Date.parse(`${b.checkedAt}T12:00:00Z`)) / 86400_000;
    if (!b.registry || !b.checkedAt || Number.isNaN(age)) { console.error(`✗ ${b.slug}: verified needs registry + checkedAt`); failed++; continue; }
    if (age > 365) { console.error(`✗ ${b.slug}: check is ${Math.round(age)} days old — re-verify before issuing a verified badge`); failed++; continue; }
  }
  const name = `${b.slug}.svg`;
  writeFileSync(join(root, "public/assets/badges", name), badgeSvg(b));
  copyFileSync(join(root, "public/assets/badges", name), join(root, "public/public/assets/badges", name));
  writeFileSync(join(root, "docs/outreach/badges", `${b.slug}.html`), snippet(b));
  console.log(`✓ ${b.slug} (${b.variant})`);
}
process.exit(failed ? 1 : 0);
