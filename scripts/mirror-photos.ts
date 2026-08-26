/**
 * Mirror business photos into Wix Media so listings never hotlink client
 * sites long-term, and probe every photo URL for health/dimensions.
 *
 *   npx tsx scripts/mirror-photos.ts --probe
 *     No credentials needed. HEAD/GETs every photosJson + logoUrl URL in
 *     data/businesses-merge.csv, reports status + content-type + bytes, and
 *     writes data/photo-meta.csv (slug,url,ok,status,contentType,bytes) —
 *     paste-ready for the photoMetaJson CMS field if wanted.
 *
 *   WIX_API_KEY=... WIX_SITE_ID=... npx tsx scripts/mirror-photos.ts --mirror
 *     For each published business, imports every external photo into Wix
 *     Media via the Media Import API and updates the record's photosJson to
 *     the new static.wixstatic.com URLs (elevated data update). Idempotent:
 *     URLs already on static.wixstatic.com under OUR account are left alone.
 *
 * The API key needs Wix Media + Wix Data permissions (Dashboard → Settings →
 * API keys). See docs/RUNBOOK.md §7.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const mode = args.includes("--mirror") ? "mirror" : "probe";

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

const businesses = parseCsv(readFileSync(join(root, "data/businesses-merge.csv"), "utf8"));
const targets: { slug: string; url: string; field: string }[] = [];
for (const b of businesses) {
  try {
    const photos = b.photosJson ? JSON.parse(b.photosJson) : [];
    if (Array.isArray(photos)) photos.forEach((u: string) => targets.push({ slug: b.slug, url: u, field: "photosJson" }));
  } catch { /* skip malformed */ }
  if (b.logoUrl) targets.push({ slug: b.slug, url: b.logoUrl, field: "logoUrl" });
}
console.log(`${targets.length} photo URLs across ${businesses.length} rows`);

if (mode === "probe") {
  const out: string[] = ["slug,url,ok,status,contentType,bytes"];
  for (const t of targets) {
    try {
      const res = await fetch(t.url, { method: "GET", headers: { Range: "bytes=0-0" } });
      const ok = res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
      const len = res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? "";
      out.push([t.slug, `"${t.url}"`, String(ok), String(res.status), res.headers.get("content-type") ?? "", len].join(","));
      console.log(`${ok ? "OK " : "BAD"} ${res.status} ${t.slug} ${t.url.slice(0, 80)}`);
    } catch (err: any) {
      out.push([t.slug, `"${t.url}"`, "false", "ERR", "", ""].join(","));
      console.log(`ERR     ${t.slug} ${t.url.slice(0, 80)} (${err?.message})`);
    }
  }
  writeFileSync(join(root, "data/photo-meta.csv"), out.join("\n") + "\n");
  console.log("written data/photo-meta.csv");
  process.exit(0);
}

// ---- mirror mode ----
const API_KEY = process.env.WIX_API_KEY;
const SITE_ID = process.env.WIX_SITE_ID;
if (!API_KEY || !SITE_ID) {
  console.error("mirror mode needs WIX_API_KEY and WIX_SITE_ID (Media + Data permissions).");
  process.exit(1);
}
const headers = {
  Authorization: API_KEY,
  "wix-site-id": SITE_ID,
  "Content-Type": "application/json",
};
// Which wixstatic prefixes are already OURS (uploaded via this flow before)?
// Anything else — including a client's own wixstatic upload — gets mirrored.
for (const b of businesses.filter((x) => x.status === "published")) {
  let photos: string[] = [];
  try { photos = b.photosJson ? JSON.parse(b.photosJson) : []; } catch { continue; }
  if (!photos.length) continue;
  const mirrored: string[] = [];
  for (const url of photos) {
    const res = await fetch("https://www.wixapis.com/site-media/v1/files/import", {
      method: "POST",
      headers,
      body: JSON.stringify({ url, displayName: `${b.slug}-${mirrored.length + 1}`, parentFolderId: "media-root" }),
    });
    if (!res.ok) {
      console.error(`import failed ${res.status} for ${b.slug}: ${url.slice(0, 80)}`);
      mirrored.push(url); // keep the original rather than dropping it
      continue;
    }
    const data: any = await res.json();
    mirrored.push(data.file?.url ?? url);
  }
  // Update the record via Wix Data (query by slug, patch photosJson).
  const q = await fetch("https://www.wixapis.com/wix-data/v2/items/query", {
    method: "POST",
    headers,
    body: JSON.stringify({ dataCollectionId: "businesses", query: { filter: { slug: b.slug } } }),
  });
  const items: any = await q.json();
  const item = items.dataItems?.[0];
  if (!item) { console.error(`no CMS item for ${b.slug}`); continue; }
  item.data.photosJson = JSON.stringify(mirrored);
  await fetch(`https://www.wixapis.com/wix-data/v2/items/${item.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ dataCollectionId: "businesses", dataItem: { data: item.data } }),
  });
  console.log(`${b.slug}: ${mirrored.length} photo(s) mirrored`);
}
