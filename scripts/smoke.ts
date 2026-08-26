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

const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
const summary = failures === 0 ? `all ${ROUTES.length} routes 200` : `${failures} FAILURE(S)`;
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
