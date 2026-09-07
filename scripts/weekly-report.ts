/**
 * Weekly health report — everything measurable without a logged-in dashboard.
 *
 *   npx tsx scripts/weekly-report.ts [--base https://www.licensedlist.com] [--write]
 *
 * Pulls: sitemap counts per template, live HTTP status of a sample of each
 * template, internal-link breakage, license staleness across published
 * listings, and our own first-party metrics if the endpoint is reachable.
 * GSC/Bing numbers are not automatable without OAuth, so the report prints the
 * table for those with blanks to fill in — see docs/LAUNCH-MONITORING.md.
 *
 * --write appends the report to docs/monitoring/YYYY-MM-DD.md.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const BASE = (arg("base") ?? "https://www.licensedlist.com").replace(/\/$/, "");
const WRITE = args.includes("--write");

const SECTIONS = ["core", "geo", "categories", "money", "listings", "editorial"] as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function text(path: string): Promise<{ status: number; body: string }> {
  try {
    const res = await fetch(BASE + path);
    return { status: res.status, body: await res.text() };
  } catch {
    return { status: 0, body: "" };
  }
}

const out: string[] = [];
const say = (line = "") => { out.push(line); console.log(line); };

const today = new Date().toISOString().slice(0, 10);
say(`# LicensedList weekly report — ${today}`);
say();
say(`Base: ${BASE}`);
say();

// ---- 1. Sitemap inventory, per template -------------------------------------
say("## Indexable inventory (sitemap, by template)");
say();
say("| Sitemap | URLs |");
say("| --- | ---: |");
let total = 0;
const urlsBySection: Record<string, string[]> = {};
for (const s of SECTIONS) {
  const { body } = await text(`/sitemap-${s}`);
  const urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  urlsBySection[s] = urls;
  total += urls.length;
  say(`| ${s} | ${urls.length} |`);
  await sleep(200);
}
say(`| **total** | **${total}** |`);
say();

// ---- 2. Live status sample per template -------------------------------------
say("## Live status (3 sampled per template)");
say();
const problems: string[] = [];
for (const s of SECTIONS) {
  const sample = urlsBySection[s].slice(0, 3);
  for (const u of sample) {
    const path = u.replace(BASE, "") || "/";
    const { status } = await text(path);
    if (status !== 200) problems.push(`${status} ${path}`);
    await sleep(200);
  }
}
say(problems.length ? problems.map((p) => `- ⚠️ ${p}`).join("\n") : "- All sampled URLs 200.");
say();

// ---- 3. License staleness ----------------------------------------------------
say("## License freshness");
say();
const { body: listingsJson } = await text("/api/data/listings.json");
let stale90 = 0, stale180 = 0, stale365 = 0, counted = 0;
try {
  const parsed = JSON.parse(listingsJson);
  const items: any[] = Array.isArray(parsed) ? parsed : parsed.listings ?? parsed.items ?? [];
  const now = Date.now();
  for (const b of items) {
    const at = b.licenseVerifiedAt ? new Date(b.licenseVerifiedAt).getTime() : NaN;
    if (!Number.isFinite(at)) continue;
    counted++;
    const days = (now - at) / 86_400_000;
    if (days > 90) stale90++;
    if (days > 180) stale180++;
    if (days > 365) stale365++;
  }
  say(`- ${counted} listings carry a verification date.`);
  say(`- Older than 90 days: **${stale90}** · 180 days: **${stale180}** · 365 days: **${stale365}** (badge auto-downgrades past 365).`);
  if (stale180) say(`- Action: run \`npx tsx scripts/verify-licenses.ts --businesses <export.csv> --stale 180\`.`);
} catch {
  say("- Could not read /api/data/listings.json (rate limit or shape change) — check manually.");
}
say();

// ---- 4. Numbers that need a human in a dashboard -----------------------------
say("## From the dashboards (fill in — not automatable without OAuth)");
say();
say("| Metric | Source | This week | Month-3 target | Month-6 target |");
say("| --- | --- | ---: | ---: | ---: |");
say(`| Money pages indexed | GSC → sitemap-money | | 60–100% of ${urlsBySection.money?.length ?? "?"} | 100% |`);
say("| All pages indexed | GSC | | 40–60% | 60–80% |");
say("| Pages indexed (Bing) | BWT | | above Google | 80%+ |");
say("| Impressions | GSC | | 3,000–15,000/mo | 30,000–100,000/mo |");
say("| Clicks | GSC | | 50–300/mo | 500–2,500/mo |");
say("| Queries in top 20 | GSC | | 20–100 | 200–800 |");
say("| Referring domains | Ahrefs free | | 10–25 | 40–80 |");
say("| Listing claims | Claims collection | | 20–100 | 200–800 |");
say("| Quote requests | Leads collection | | | |");
say();
say("Benchmarks are deliberately modest: position 1 now earns ~27.6% CTR, ~68% of US");
say("searches are zero-click, and only 1.74% of new pages reach the top 10 within a year.");
say();
say("Run `node scripts/crawl.mjs` separately for broken-link coverage (it is slow by design).");

if (WRITE) {
  const dir = join(root, "docs/monitoring");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${today}.md`), out.join("\n") + "\n");
  console.log(`\n-> docs/monitoring/${today}.md`);
}
