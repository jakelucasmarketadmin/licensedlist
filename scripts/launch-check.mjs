/**
 * Launch-readiness checker (end of build phase) — runs against LIVE:
 *
 *   node scripts/launch-check.mjs [--base https://...]
 *
 * 1. Indexable templates: canonical + title + description + breadcrumb
 *    JSON-LD (where applicable) present.
 * 2. Noindex set on preview/search/saved/account/owner/write-review/
 *    get-listed-basic.
 * 3. Client/paid links carry rel="sponsored" + visible label.
 * 4. Registry rows: data-nosnippet, unlinked names, no /business/reg- URLs.
 * 5. Sitemap URL count vs live checks; robots.txt points at /sitemap.
 *
 * Prints a PASS/FAIL table (consumed into docs/LAUNCH-CHECKLIST.md).
 */
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
// Default is the live canonical host. The old Wix temp host now 404s on deep
// URLs (docs/DECISIONS.md), so pointing this at it produces 29 phantom failures.
const BASE = baseIdx >= 0 ? args[baseIdx + 1].replace(/\/$/, "") : "https://www.licensedlist.com";

const results = [];
const check = (group, name, ok, note = "") => {
  results.push({ group, name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  [${group}] ${name}${note ? ` — ${note}` : ""}`);
};

const get = async (path) => {
  const res = await fetch(BASE + path, { redirect: "manual" });
  return { status: res.status, html: res.ok ? await res.text() : "" };
};

// ---- 1. Indexable templates -------------------------------------------------
const INDEXABLE = [
  ["home", "/", { breadcrumb: false }],
  ["state hub", "/nj", {}],
  ["county hub", "/nj/bergen-county", {}],
  ["town hub", "/nj/bergen-county/westwood", {}],
  ["category hub", "/plumbers", {}],
  // NOTE: no geo×category list page meets the 3-listing rule yet (inventory,
  // not a defect) — the template is exercised via the preview URL in the
  // noindex section below.
  ["profile", "/business/hofmeister-plumbing", {}],
  ["methodology", "/how-we-verify", {}],
  ["guides index", "/guides", {}],
  ["events", "/events", {}],
  ["deals", "/deals", {}],
  ["awards", "/awards", {}],
  ["founding", "/founding-members", {}],
  ["ai-info", "/ai-info", {}],
  ["pricing", "/pricing", {}],
];
for (const [name, path, opts] of INDEXABLE) {
  const { status, html } = await get(path);
  if (status !== 200) { check("meta", `${name} ${path}`, false, `HTTP ${status}`); continue; }
  const canonical = html.includes(`rel="canonical" href="${BASE}${path === "/" ? "/" : path}"`);
  const title = /<title>[^<]{10,}<\/title>/.test(html);
  const description = /name="description" content="[^"]{40,}"/.test(html);
  const noindexed = /name="robots" content="[^"]*noindex/.test(html);
  const breadcrumb = opts.breadcrumb === false || html.includes('"BreadcrumbList"');
  check("meta", `${name} ${path}`,
    canonical && title && description && breadcrumb && !noindexed,
    [
      !canonical && "no canonical",
      !title && "weak/missing title",
      !description && "weak/missing description",
      !breadcrumb && "no breadcrumb JSON-LD",
      noindexed && "UNEXPECTED noindex",
    ].filter(Boolean).join(", "));
}

// Profile JSON-LD sanity: LocalBusiness type present, aggregateRating absent
// while on-site reviews < 3.
{
  const { html } = await get("/business/hofmeister-plumbing");
  check("meta", "profile JSON-LD LocalBusiness", /"@type":"(Plumber|LocalBusiness)"/.test(html));
  check("meta", "profile aggregateRating suppressed (<3 site reviews)", !html.includes("aggregateRating"));
}

// ---- 2. Noindex pages -------------------------------------------------------
const NOINDEX = [
  "/search",
  "/saved",
  "/account",
  "/owner",
  "/write-review",
  "/for-businesses/get-listed-basic",
  "/nj/bergen-county/plumbers?preview=demo",
  "/business/placeholder-plumbing-llc?preview=demo",
];
for (const path of NOINDEX) {
  const { status, html } = await get(path);
  check("noindex", path, status === 200 && /name="robots" content="[^"]*noindex/.test(html), status !== 200 ? `HTTP ${status}` : "");
}

// ---- 3. Sponsored links -----------------------------------------------------
{
  const { html } = await get("/business/hofmeister-plumbing");
  check("sponsored", "client profile shows label", html.includes("client of the agency"));
  // Policy changed 2026-09-07: rel="sponsored" describes PAID placement only.
  // An agency client on the free tier is labelled visibly and linked like any
  // other listing — so the correct assertion is the opposite of the old one.
  const clientNotSponsored = !/rel="sponsored/.test(html);
  check("sponsored", "client listing is NOT rel=sponsored (labelled instead)", clientNotSponsored);
  const list = await get("/nj/bergen-county/hackensack/roofers");
  check("sponsored", "list page labels paid placement", !list.html.includes("Featured ·") || list.html.includes("paid placement, always labeled"));
}

// ---- 4. Registry rendering rules -------------------------------------------
{
  const { html } = await get("/ny/kings-county");
  check("registry", "table section is data-nosnippet", /data-nosnippet[^>]*data-registry-root|data-registry-root[^>]*data-nosnippet|<section[^>]*data-nosnippet/.test(html));
  const rowMatch = html.match(/<tbody data-registry-body[^>]*>([\s\S]{0,1200})/);
  const rowHtml = rowMatch ? rowMatch[1] : "";
  check("registry", "row business names are unlinked", rowHtml.includes("<tr") && !/(<td[^>]*>\s*<a )/.test(rowHtml.split("</td>")[0] ?? ""));
  const reg404 = await fetch(`${BASE}/business/reg-2106052-dca`, { redirect: "manual" });
  check("registry", "/business/reg-… returns 404", reg404.status === 404);
  console.log("\n--- sample registry row HTML (evidence) ---");
  console.log((rowHtml.split("</tr>")[0] ?? "").trim().slice(0, 900));
  console.log("--- end sample ---\n");
}

// ---- 5. Sitemap & robots ----------------------------------------------------
{
  const sm = await get("/sitemap");
  const urls = [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check("sitemap", `sitemap parses (${urls.length} URLs)`, urls.length > 100);
  check("sitemap", "no registry URLs in sitemap", !urls.some((u) => u.includes("/business/reg-")));
  check("sitemap", "no noindex routes in sitemap", !urls.some((u) => /\/(search|saved|account|owner|write-review|get-listed-basic)$/.test(u)));
  const lastmod = (sm.html.match(/<lastmod>([^<]+)<\/lastmod>/g) ?? []).length;
  check("sitemap", `lastmod present (${lastmod}/${urls.length})`, lastmod === urls.length);
  const robots = await fetch(`${BASE}/robots.txt`).then((r) => r.text()).catch(() => "");
  check("sitemap", "robots.txt points at sitemap", /sitemap/i.test(robots));
  // Spot-check 12 sampled sitemap URLs resolve 200 + indexable.
  const sample = urls.filter((_, i) => i % Math.ceil(urls.length / 12) === 0).slice(0, 12);
  let all200 = true;
  for (const u of sample) {
    const r = await fetch(u, { redirect: "manual" });
    if (r.status !== 200) { all200 = false; console.log(`  sampled ${u} -> ${r.status}`); }
  }
  check("sitemap", `sampled ${sample.length} sitemap URLs all 200`, all200);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — ${failed.length} FAILURES` : ""}`);
process.exit(failed.length ? 1 : 0);
