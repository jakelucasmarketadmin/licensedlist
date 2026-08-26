/**
 * Generate the downloadable "TriVetted Best of {County} {Year}" badge SVG a
 * winner can embed on their own site (plain link back, rel handled by us —
 * we never hand out embed code with dofollow links).
 *
 *   npx tsx scripts/award-badge.ts --county "Bergen County" --year 2026 [--demo]
 *
 * Output: public/assets/awards/best-of-{slug}-{year}[-demo].svg (+ the
 * public/public hedge copy).
 */
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const county = arg("county") ?? "Bergen County";
const year = arg("year") ?? String(new Date().getFullYear());
const demo = args.includes("--demo");
const slug = county.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="280" viewBox="0 0 240 280" role="img" aria-label="TriVetted Best of ${county} ${year}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#14456b"/><stop offset="1" stop-color="#0b2b45"/>
    </linearGradient>
  </defs>
  <path d="M120 6 L226 40 V150 C226 210 180 252 120 274 C60 252 14 210 14 150 V40 Z" fill="url(#bg)" stroke="#fffdf8" stroke-width="4"/>
  <path d="M120 26 L206 54 V148 C206 196 170 232 120 252 C70 232 34 196 34 148 V54 Z" fill="none" stroke="#c24e0a" stroke-width="2" opacity="0.9"/>
  <text x="120" y="78" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="21" font-weight="700" fill="#fffdf8">TriVetted</text>
  <text x="120" y="106" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" letter-spacing="3" fill="#e6eef5">BEST OF</text>
  <text x="120" y="140" text-anchor="middle" font-family="Georgia, serif" font-size="${county.length > 14 ? 15 : 18}" font-weight="700" fill="#fffdf8">${county.toUpperCase()}</text>
  <text x="120" y="182" text-anchor="middle" font-family="Georgia, serif" font-size="40" font-weight="700" fill="#c24e0a">${year}</text>
  <text x="120" y="212" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="9.5" letter-spacing="1.5" fill="#e6eef5">LICENSE-VERIFIED · DATA-DRIVEN</text>
  <text x="120" y="230" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="9.5" letter-spacing="1.5" fill="#e6eef5">NEVER PAY-TO-PLAY</text>
  ${demo ? `<text x="120" y="252" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="2" fill="#f7eeda">SAMPLE</text>` : ""}
</svg>
`;

mkdirSync(join(root, "public/assets/awards"), { recursive: true });
mkdirSync(join(root, "public/public/assets/awards"), { recursive: true });
const name = `best-of-${slug}-${year}${demo ? "-demo" : ""}.svg`;
writeFileSync(join(root, "public/assets/awards", name), svg);
copyFileSync(join(root, "public/assets/awards", name), join(root, "public/public/assets/awards", name));
console.log(`public/assets/awards/${name}`);
