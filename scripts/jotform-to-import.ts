/**
 * Pull business-intake submissions from the Jotform API and write them as an
 * import CSV in the exact shape of data/clients-import-template.csv (+ a
 * trailing reviewNotes column for anything that needs a human eye).
 *
 *   JOTFORM_API_KEY=... npx tsx scripts/jotform-to-import.ts [--since YYYY-MM-DD]
 *
 * Output: data/intake/{today}-submissions.csv. Nothing is imported here — run
 * the normal path afterwards:
 *   npx tsx scripts/import-businesses.ts data/intake/{today}-submissions.csv --dry-run
 * then verify licenses (docs/VERIFICATION.md) and import per docs/RUNBOOK.md.
 *
 * Mapping rules:
 * - Towns in "counties or cities served" resolve state-scoped against the
 *   seeded towns; unresolvable names land in reviewNotes, never dropped.
 * - Category label matches name → synonyms → substring; no match → reviewNotes.
 * - licenseVerifiedAt is ALWAYS left blank — verification fills it.
 * - licenseSource is left blank; the submitted "State of License" goes to
 *   reviewNotes so the verifier picks the exact registry.
 * - isClient=false, tier=free for intake submissions.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOWN_SEED, COUNTY_SEED, STATE_SEED } from "../src/data/geo.generated.ts";
import { CATEGORY_SEED } from "../src/data/taxonomy.generated.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORM_ID = "262358080828059";
const apiKey = process.env.JOTFORM_API_KEY;
if (!apiKey) {
  console.error("Set JOTFORM_API_KEY (Jotform → Settings → API).");
  process.exit(1);
}
const sinceArg = process.argv.includes("--since")
  ? process.argv[process.argv.indexOf("--since") + 1]
  : null;

// ---------- helpers ----------
const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const STATE_BY_NAME = new Map<string, string>([
  ["new jersey", "nj"], ["nj", "nj"],
  ["new york", "ny"], ["ny", "ny"],
  ["pennsylvania", "pa"], ["pa", "pa"],
]);

/** State-scoped town resolution by display name or slug. */
function resolveTown(nameOrSlug: string, stateSlugs: string[]) {
  const needle = nameOrSlug.trim().toLowerCase();
  const asSlug = slugify(needle);
  for (const st of stateSlugs) {
    const hit = TOWN_SEED.find(
      (t) => t.stateSlug === st && (t.name.toLowerCase() === needle || t.slug === asSlug),
    );
    if (hit) return hit;
  }
  return undefined;
}

function resolveCategory(label: string) {
  const needle = label.trim().toLowerCase();
  if (!needle) return undefined;
  return (
    CATEGORY_SEED.find((c) => c.name.toLowerCase() === needle || c.slug === slugify(needle)) ??
    CATEGORY_SEED.find((c) => c.synonyms.some((s) => s.toLowerCase() === needle)) ??
    CATEGORY_SEED.find((c) => c.name.toLowerCase().includes(needle)) ??
    CATEGORY_SEED.find((c) => c.synonyms.some((s) => s.toLowerCase().includes(needle)))
  );
}

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ---------- fetch ----------
const url = `https://api.jotform.com/form/${FORM_ID}/submissions?apiKey=${apiKey}&limit=1000&orderby=created_at`;
const res = await fetch(url);
if (!res.ok) {
  console.error(`Jotform API ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const payload: any = await res.json();
let submissions: any[] = (payload.content ?? []).filter((s: any) => s.status !== "DELETED");
if (sinceArg) submissions = submissions.filter((s) => s.created_at >= sinceArg);

// ---------- map (question ids inspected on the live form — see RUNBOOK) ----------
// 2 add/update · 3 name · 4 address · 5 phone · 6 email · 7 website · 8 owner name
// 9 owner email · 10 owner phone · 11 category · 12 states served · 13 towns text
// 14 license number · 15 license state · 16 description · 17 social · 18 upload
const HEADER = "name,slug,primaryCategorySlug,categorySlugs,stateSlug,countySlug,townSlug,serviceTownSlugs,address1,address2,city,state,zip,phone,website,email,description,whyWePicked,yearsInBusiness,foundedYear,services,logoUrl,photoUrls,licenseNumber,licenseSource,licenseVerifiedAt,insuredStatus,ratingGoogle,ratingGoogleCount,ratingYelp,ratingYelpCount,ratingFacebook,ratingFacebookCount,responseTimeHours,isClient,tier,hoursJson,sourceNotes,licenseHolder,reviewNotes".split(",");

const rows: Record<string, string>[] = [];
for (const sub of submissions) {
  const a = sub.answers ?? {};
  const ans = (qid: number): any => a[String(qid)]?.answer;
  const text = (qid: number): string => {
    const v = ans(qid);
    return typeof v === "string" ? v.trim() : "";
  };
  const review: string[] = [];

  const name = text(3);
  if (!name) continue;
  const addr = ans(4) ?? {};
  const statesServed: string[] = Array.isArray(ans(12)) ? ans(12) : ans(12) ? [String(ans(12))] : [];
  const stateSlugs = statesServed
    .map((s) => STATE_BY_NAME.get(String(s).trim().toLowerCase()))
    .filter((s): s is string => Boolean(s));
  const homeState =
    STATE_BY_NAME.get(String(addr.state ?? "").trim().toLowerCase()) ?? stateSlugs[0] ?? "";
  if (!homeState) review.push(`unresolved home state "${addr.state ?? ""}"`);

  const homeTown = homeState ? resolveTown(String(addr.city ?? ""), [homeState]) : undefined;
  if (!homeTown) review.push(`unresolved home town "${addr.city ?? ""}" in ${homeState || "?"}`);

  // Service towns: free text, comma/newline/semicolon separated.
  const scopes = stateSlugs.length ? stateSlugs : STATE_SEED.map((s) => s.slug);
  const serviceTownSlugs: string[] = [];
  for (const part of text(13).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)) {
    const town = resolveTown(part, scopes);
    if (town) serviceTownSlugs.push(town.slug);
    else if (COUNTY_SEED.some((c) => scopes.includes(c.stateSlug) && (c.name.toLowerCase() === part.toLowerCase() || c.slug === slugify(part))))
      review.push(`county-level service area "${part}" — expand to towns manually`);
    else review.push(`unresolved service area "${part}"`);
  }
  if (homeTown && !serviceTownSlugs.includes(homeTown.slug)) serviceTownSlugs.unshift(homeTown.slug);

  const category = resolveCategory(text(11));
  if (!category) review.push(`unresolved category "${text(11)}"`);

  const licenseState = text(15);
  if (licenseState) review.push(`license state per form: ${licenseState} — pick registry during verification`);

  const uploads: string[] = Array.isArray(ans(18)) ? ans(18) : ans(18) ? [String(ans(18))] : [];
  if (uploads.length) review.push("uploads in photoUrls — move one to logoUrl if it's a logo");
  const social = text(17);
  if (social) review.push(`social links: ${social.replace(/\s+/g, " ")}`);
  const addOrUpdate = text(2);
  const ownerName = ans(8) ? `${ans(8).first ?? ""} ${ans(8).last ?? ""}`.trim() : "";

  rows.push({
    name,
    slug: slugify(name),
    primaryCategorySlug: category?.slug ?? "",
    categorySlugs: category?.slug ?? "",
    stateSlug: homeState,
    countySlug: homeTown?.countySlug ?? "",
    townSlug: homeTown?.slug ?? "",
    serviceTownSlugs: serviceTownSlugs.join(","),
    address1: String(addr.addr_line1 ?? "").trim(),
    address2: String(addr.addr_line2 ?? "").trim(),
    city: String(addr.city ?? "").trim(),
    state: String(addr.state ?? "").trim(),
    zip: String(addr.postal ?? "").trim(),
    phone: String(ans(5)?.full ?? ans(5) ?? "").trim(),
    website: text(7),
    email: text(6),
    description: text(16),
    whyWePicked: "",
    yearsInBusiness: "",
    foundedYear: "",
    services: "",
    logoUrl: "",
    photoUrls: uploads.join(","),
    licenseNumber: text(14),
    licenseSource: "",
    licenseVerifiedAt: "", // always blank — verification fills it
    insuredStatus: "",
    ratingGoogle: "", ratingGoogleCount: "", ratingYelp: "", ratingYelpCount: "",
    ratingFacebook: "", ratingFacebookCount: "", responseTimeHours: "",
    isClient: "false",
    tier: "free",
    hoursJson: "",
    sourceNotes: `Jotform intake ${sub.created_at} (submission ${sub.id}; ${addOrUpdate || "?"}). Owner contact: ${ownerName} ${text(9)} ${String(ans(10)?.full ?? "")}`.trim(),
    licenseHolder: "",
    reviewNotes: review.join(" | "),
  });
}

const date = new Date().toISOString().slice(0, 10);
mkdirSync(join(root, "data/intake"), { recursive: true });
const outPath = join(root, `data/intake/${date}-submissions.csv`);
writeFileSync(
  outPath,
  [HEADER.join(","), ...rows.map((r) => HEADER.map((h) => esc(r[h])).join(","))].join("\n") + "\n",
);
const flagged = rows.filter((r) => r.reviewNotes).length;
console.log(`${rows.length} submission(s) → ${outPath} · ${flagged} with reviewNotes`);
