/**
 * Render the home-bento static map: the brand MapLibre style over the
 * tri-state region with a dot per published verified business.
 *
 *   npx tsx scripts/render-static-map.ts [--points data/map-points.json]
 *
 * Runs headless Chrome via puppeteer-core (same toolchain as the QA shooter),
 * loading the vendored maplibre from public/vendor/ — no npm install needed.
 * Output: public/assets/tri-state-map.webp + .png (and the public/public
 * hedge copies). Points default to the current businesses-merge.csv published
 * rows. Regenerate after imports; the home tile falls back to an inline SVG
 * outline map if these files are missing.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

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

let points: { lat: number; lng: number }[];
const pointsArg = args.includes("--points") ? args[args.indexOf("--points") + 1] : null;
if (pointsArg) {
  points = JSON.parse(readFileSync(isAbsolute(pointsArg) ? pointsArg : join(root, pointsArg), "utf8"));
} else {
  points = parseCsv(readFileSync(join(root, "data/businesses-merge.csv"), "utf8"))
    .filter((b) => b.status === "published")
    .map((b) => ({ lat: Number(b.lat), lng: Number(b.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
console.log(`${points.length} business dots`);

const style = readFileSync(join(root, "src/map/style-light.json"), "utf8");
const maplibreJs = readFileSync(join(root, "public/vendor/maplibre-gl.mjs"), "utf8");
const sharedJs = readFileSync(join(root, "public/vendor/maplibre-gl-shared.mjs"), "utf8");
const workerJs = readFileSync(join(root, "public/vendor/maplibre-gl-worker.mjs"), "utf8");
const css = readFileSync(join(root, "public/vendor/maplibre-gl.css"), "utf8");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html,body,#map{margin:0;width:900px;height:560px}</style></head>
<body><div id="map"></div>
<script type="module">
import * as maplibregl from "/vendor/maplibre-gl.mjs";
maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
const map = new maplibregl.Map({
  container: "map",
  style: ${JSON.stringify(JSON.parse(style))},
  bounds: [[-76.9, 39.6], [-72.4, 42.9]],
  fitBoundsOptions: { padding: 20 },
  attributionControl: { compact: false, customAttribution: "Map data © OpenStreetMap contributors · OpenFreeMap" },
  interactive: false,
});
for (const p of ${JSON.stringify(points)}) {
  const el = document.createElement("span");
  el.style.cssText = "display:block;width:12px;height:12px;border-radius:99px;background:#c24e0a;border:2px solid #fffdf8;box-shadow:0 1px 4px rgba(16,36,56,.4)";
  new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
}
map.on("idle", () => { window.__mapReady = true; });
</script></body></html>`;

const outDir = join(root, "public/assets");
mkdirSync(outDir, { recursive: true });
mkdirSync(join(root, "public/public/assets"), { recursive: true });

// Tiny local server so the module imports and worker resolve like production.
const { createServer } = await import("node:http");
const server = createServer((req, res) => {
  if (req.url === "/") { res.setHeader("Content-Type", "text/html"); res.end(html); }
  else if (req.url === "/vendor/maplibre-gl.mjs") { res.setHeader("Content-Type", "text/javascript"); res.end(maplibreJs); }
  else if (req.url === "/vendor/maplibre-gl-shared.mjs") { res.setHeader("Content-Type", "text/javascript"); res.end(sharedJs); }
  else if (req.url === "/vendor/maplibre-gl-worker.mjs") { res.setHeader("Content-Type", "text/javascript"); res.end(workerJs); }
  else { res.statusCode = 404; res.end(); }
});
await new Promise<void>((r) => server.listen(4477, r));

const { default: puppeteer } = await import(
  "/private/tmp/claude-501/-Users-jake-claude-code-new-hof/133282df-1418-4415-9d0e-ec6e42a6aa19/scratchpad/shooter/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js"
);
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 560, deviceScaleFactor: 2 });
await page.goto("http://localhost:4477/", { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForFunction("window.__mapReady === true", { timeout: 60000 });
await new Promise((r) => setTimeout(r, 500));
const webp = await page.screenshot({ type: "webp", quality: 82 });
const png = await page.screenshot({ type: "png" });
writeFileSync(join(outDir, "tri-state-map.webp"), webp);
writeFileSync(join(outDir, "tri-state-map.png"), png);
copyFileSync(join(outDir, "tri-state-map.webp"), join(root, "public/public/assets/tri-state-map.webp"));
copyFileSync(join(outDir, "tri-state-map.png"), join(root, "public/public/assets/tri-state-map.png"));
await browser.close();
server.close();
console.log("written public/assets/tri-state-map.{webp,png}");
