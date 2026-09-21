/**
 * Post-publish smoke test — run after EVERY publish (~5 seconds):
 *
 *   npx tsx scripts/smoke.ts [--base https://...] [--log]
 *
 * Checks the critical routes for HTTP 200 (and that /sitemap returns XML with
 * <loc> entries). Exits non-zero on any failure. With --log, appends the
 * result to docs/PUBLISH-LOG.md so every publish leaves an audit line.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE =
  baseIdx >= 0 ? args[baseIdx + 1].replace(/\/$/, "") : "https://my-site-nf00gfth-tier201.wix-vibe-site.com";

const ROUTES = [
  "/",
  "/nj",
  "/ny",
  "/pa",
  "/nj/bergen-county",
  "/nj/bergen-county/hackensack",
  "/roofers",
  "/pricing",
  "/business/hofmeister-plumbing",
  "/events",
  "/deals",
  "/guides",
  "/awards",
  "/founding-members",
  "/saved",
  "/account",
  "/ai-info",
  "/write-review?biz=hofmeister-plumbing",
  "/sitemap",
];

let failures = 0;
const lines: string[] = [];
for (const path of ROUTES) {
  let status = 0;
  let note = "";
  try {
    const res = await fetch(BASE + path, { redirect: "manual" });
    status = res.status;
    if (path === "/sitemap" && status === 200) {
      const xml = await res.text();
      if (!xml.includes("<loc>")) { note = " (no <loc> entries!)"; failures++; }
    }
  } catch (err: any) {
    note = ` (${err?.message ?? err})`;
  }
  const ok = status === 200 && !note;
  if (!ok) failures++;
  lines.push(`${ok ? "OK " : "FAIL"} ${status} ${path}${note}`);
  console.log(lines[lines.length - 1]);
}

// ---------------------------------------------------------------------------
// Phase 4 §10.2 guardrails. These fail the build rather than the review.
// ---------------------------------------------------------------------------
const guard = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  const line = `${ok ? "OK " : "FAIL"} [guard] ${name}${detail ? ` — ${detail}` : ""}`;
  lines.push(line);
  console.log(line);
};

const text = async (path: string) => {
  try {
    const res = await fetch(BASE + path);
    return { status: res.status, body: await res.text() };
  } catch {
    return { status: 0, body: "" };
  }
};

console.log("");

// robots.txt: exactly one Sitemap line, pointing at production /sitemap-index.
{
  const { body } = await text("/robots.txt");
  const sitemapLines = body.split("\n").filter((l) => /^\s*sitemap:/i.test(l));
  guard("robots.txt has exactly one Sitemap: line", sitemapLines.length === 1,
    `found ${sitemapLines.length}`);
  guard("robots.txt Sitemap points at production /sitemap-index",
    sitemapLines.length === 1 && sitemapLines[0].includes(`${BASE}/sitemap-index`),
    sitemapLines[0]?.trim() ?? "none");
  guard("robots.txt disallows /owner", /disallow:\s*\/owner/i.test(body));
}

// No rendered ZIP shorter than 5 digits (the NJ leading-zero bug).
// No meta description ending in an ellipsis or over 160 characters.
// No em-dash placeholder cells. No empty-section copy.
{
  const samples = [
    "/", "/nj", "/nj/bergen-county", "/nj/bergen-county/westwood",
    "/nj/bergen-county/westwood/plumbers", "/business/pascale-electric",
    "/pa/montgomery-county/blue-bell/spas",
  ];
  const shortZips: string[] = [];
  const badDescriptions: string[] = [];
  const placeholders: string[] = [];
  const emptySections: string[] = [];
  for (const path of samples) {
    const { status, body } = await text(path);
    if (status !== 200) continue;
    for (const m of body.matchAll(/\b(?:NJ|NY|PA)\s+(\d{1,4})\b/g)) shortZips.push(`${path}: ${m[0]}`);
    for (const m of body.matchAll(/"postalCode":"(\d{1,4})"/g)) shortZips.push(`${path}: postalCode ${m[1]}`);
    const desc = body.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
    if (desc && (desc.endsWith("…") || desc.endsWith("...") || desc.length > 160)) {
      badDescriptions.push(`${path}: ${desc.length} chars${desc.endsWith("…") ? ", ends …" : ""}`);
    }
    if (/>—<\/td>|py-3 text-muted">—</.test(body)) placeholders.push(path);
    if (/Nothing listed yet|Listings coming soon/.test(body)) emptySections.push(path);
  }
  guard("no rendered ZIP shorter than 5 digits", shortZips.length === 0, shortZips.slice(0, 3).join("; "));
  guard("no meta description truncated or over 160 chars", badDescriptions.length === 0,
    badDescriptions.slice(0, 3).join("; "));
  guard("no em-dash placeholder cells", placeholders.length === 0, placeholders.join(", "));
  guard("no empty-section placeholder copy", emptySections.length === 0, emptySections.join(", "));
}

// Client ratio: agency clients must stay a minority of published listings.
// When this trips, the fix is publishing more non-clients — never hiding the
// disclosure (§0.5).
{
  const { body } = await text("/sitemap-listings");
  const slugs = [...body.matchAll(/<loc>[^<]*\/business\/([a-z0-9-]+)<\/loc>/g)].map((m) => m[1]);
  let clients = 0;
  for (const slug of slugs) {
    const { body: profile } = await text(`/business/${slug}`);
    if (/client of the agency/i.test(profile)) clients++;
  }
  const ratio = slugs.length ? clients / slugs.length : 0;
  const pct = (ratio * 100).toFixed(1);
  console.log(`\n[client ratio] ${clients}/${slugs.length} published listings are agency clients (${pct}%)`);
  guard("agency clients are 25% or less of published listings", ratio <= 0.25,
    `${pct}% — publish more non-clients`);
}

const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
const summary = failures === 0 ? `all ${ROUTES.length} routes 200 + guardrails` : `${failures} FAILURE(S)`;
console.log(failures === 0 ? `\nSMOKE PASS — ${summary}` : `\nSMOKE FAIL — ${summary}`);

if (args.includes("--log")) {
  const logPath = join(root, "docs/PUBLISH-LOG.md");
  const log = readFileSync(logPath, "utf8");
  writeFileSync(
    logPath,
    log.trimEnd() +
      `\n\n**Smoke ${stamp}:** ${failures === 0 ? "PASS" : "FAIL"} — ${summary}` +
      (failures ? "\n```\n" + lines.filter((l) => l.startsWith("FAIL")).join("\n") + "\n```" : "") +
      "\n",
  );
  console.log("logged to docs/PUBLISH-LOG.md");
}

process.exit(failures === 0 ? 0 : 1);
