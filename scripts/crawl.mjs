/**
 * Internal link crawl: BFS over same-origin <a href>, reporting non-200s.
 * Lives in the repo (not a scratchpad) because it is part of the publish
 * routine and the monthly maintenance run — see docs/RUNBOOK.md.
 *
 *   node scripts/crawl.mjs [baseUrl]
 */
const BASE = (process.argv[2] || "https://www.licensedlist.com").replace(/\/$/, "");
const origin = new URL(BASE).origin;
const seen = new Set(["/"]);
const queue = ["/"];
const broken = [];
let checked = 0;

const norm = (href, from) => {
  try {
    const u = new URL(href, BASE + from);
    if (u.origin !== origin) return null;
    if (/\.(png|jpg|jpeg|svg|webp|ico|css|js|txt|json)$/i.test(u.pathname)) return null;
    return u.pathname;
  } catch { return null; }
};

// Politeness: Wix rate-limits (429) well before this finishes at high
// concurrency, and a 429 storm looks exactly like a site full of broken links.
const CONCURRENCY = 3;
const DELAY_MS = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

while (queue.length) {
  const batch = queue.splice(0, CONCURRENCY);
  await Promise.all(batch.map(async (path) => {
    let res, html = "";
    try {
      res = await fetch(BASE + path, { redirect: "follow" });
      html = await res.text();
    } catch (e) {
      broken.push({ path, status: `FETCH_ERROR ${e.message}` });
      return;
    }
    checked++;
    if (res.status === 429) { queue.push(path); seen.delete(path); await sleep(2000); return; }
    if (res.status !== 200) { broken.push({ path, status: res.status }); return; }
    // Inline scripts assemble hrefs from string fragments at runtime; those are
    // not links in the served document, so strip scripts before extracting.
    const doc = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    for (const m of doc.matchAll(/<a[^>]+href="([^"#]+)"/g)) {
      const p = norm(m[1], path);
      if (p && !seen.has(p)) { seen.add(p); queue.push(p); }
    }
  }));
  await sleep(DELAY_MS);
}
console.log(`crawled ${BASE}: checked ${checked} pages, discovered ${seen.size}`);
console.log("broken:", JSON.stringify(broken));
process.exit(broken.length ? 1 : 0);
