import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";

/**
 * TEMPORARY Batch B setup endpoint — run once on the dev preview origin, then
 * DELETE this file before publishing (it must never ship to the live site).
 *
 * Creates/extends collections (reviews, servicePrices, questions; new fields
 * on businesses + leads), then seeds DEMO reviews/Q&A/prices for the two
 * sample plumbing profiles and real, source-verified profile extras for the
 * Hofmeister showcase (projects/photos mirrored from the client's own site).
 *
 * POST /api/admin-seed  { step: "schema" | "seed" | "verify" }
 * header: x-seed-secret must match SEED_SECRET below.
 */
const SEED_SECRET = "tv-b2-seed-4f1c9a7e2b8d4e6f9a3c5d7e1b2f4a6c";

type FieldDef = { key: string; type: string };
const T = (key: string): FieldDef => ({ key, type: "TEXT" });
const N = (key: string): FieldDef => ({ key, type: "NUMBER" });
const B = (key: string): FieldDef => ({ key, type: "BOOLEAN" });

const NEW_COLLECTIONS: { id: string; displayName: string; fields: FieldDef[] }[] = [
  {
    id: "reviews",
    displayName: "Reviews",
    fields: [
      T("businessSlug"), T("reviewerName"), T("reviewerEmail"), N("rating"), T("body"),
      T("jobType"), T("townName"), T("aspectsJson"), T("photosJson"), B("verifiedHire"),
      T("source"), T("moderationStatus"), T("ownerResponse"), T("ownerRespondedAt"),
      T("ownerFlag"), T("leadId"),
    ],
  },
  {
    id: "servicePrices",
    displayName: "Service Prices",
    fields: [T("businessSlug"), T("service"), T("priceLabel"), T("unit"), T("note"), N("sortOrder")],
  },
  {
    id: "questions",
    displayName: "Questions",
    fields: [
      T("businessSlug"), T("question"), T("askerName"), T("askerEmail"), T("answer"),
      T("answeredAt"), T("moderationStatus"),
    ],
  },
];

const FIELD_ADDITIONS: Record<string, FieldDef[]> = {
  businesses: [T("highlights"), T("projectsJson"), T("teamJson"), T("faqJson")],
  leads: [
    T("wonAt"), T("reviewToken"), T("reviewInviteSentAt"), T("reviewReminderSentAt"),
    T("reviewSubmittedAt"),
  ],
};

// ---- seed data --------------------------------------------------------------

const wix = (id: string) => `https://static.wixstatic.com/media/${id}`;
// Stock renders from the agency media library (not client job photos) — used
// only on clearly-labeled DEMO sample listings.
const STOCK = {
  waterHeater: wix("1f5d89_4e226e9c96e94686b99f70a81ac8375f~mv2.png"),
  sewer: wix("1f5d89_1c068131469047719d023fb106ebe974~mv2.png"),
  ac: wix("1f5d89_81234291f75643debc724c6388dbabb9~mv2.png"),
  furnace: wix("1f5d89_7d789195797e4d9b888f2450e29d377d~mv2.png"),
  repipe: wix("1f5d89_921cd9ea09e64f3581fec5d886a747e6~mv2.png"),
};
// Real Hofmeister media, mirrored from the client's own published site.
const HOF = {
  van: wix("1f5d89_f6fda50ffb14476381141a5181aa4e17~mv2.jpg"),
  team: wix("1f5d89_2d413377ccb042cd988d6255115fb0da~mv2.png"),
  drainJob: wix("1f5d89_f9539a1c80034f30989e415cbdb2358e~mv2.png"),
  castIron: wix("1f5d89_e8c8ef680d4641389389b1862f96f746~mv2.png"),
  acService: wix("1f5d89_33c438c5ad1343e191c751997964c942~mv2.png"),
  heaterJob: wix("1f5d89_8f3f9adde3b64452b9ad95b7be31595e~mv2.jpeg"),
  tubDrain: wix("1f5d89_4ca1845344bb4640ab9aeb38067f3b52~mv2.jpeg"),
};

const DEMO_REVIEWS = [
  // placeholder-plumbing-llc — full spread incl. critical reviews (FTC: no
  // sentiment gating, so the sample data shouldn't be all 5s either).
  { businessSlug: "placeholder-plumbing-llc", reviewerName: "Dana M.", rating: 5, jobType: "Water heater replacement", townName: "Hackensack, NJ", verifiedHire: true, source: "trivetted", body: "Our water heater died on a Friday night and they had a new one running by Saturday afternoon. Clear quote up front, no surprise charges, and they hauled the old tank away.", aspectsJson: JSON.stringify({ quality: 5, communication: 5, value: 4, timeliness: 5 }), photosJson: JSON.stringify([STOCK.waterHeater]), ownerResponse: "Thanks Dana — glad we could get your hot water back before the weekend was over. Enjoy the new tankless unit!", ownerRespondedAt: "2026-08-20T14:00:00Z" },
  { businessSlug: "placeholder-plumbing-llc", reviewerName: "Rob T.", rating: 5, jobType: "Drain cleaning", townName: "Teaneck, NJ", verifiedHire: true, source: "trivetted", body: "Kitchen line was backing up for weeks. They scoped it, showed me the clog on camera, and jetted it clear in under an hour. Explained everything as they went.", aspectsJson: JSON.stringify({ quality: 5, communication: 5, value: 5, timeliness: 4 }) },
  { businessSlug: "placeholder-plumbing-llc", reviewerName: "Priya S.", rating: 4, jobType: "Leak detection", townName: "Bergenfield, NJ", verifiedHire: true, source: "trivetted", body: "Found a pinhole leak behind the wall that two other companies missed. Took a day longer to schedule than promised, but the repair itself was clean and tidy.", aspectsJson: JSON.stringify({ quality: 5, communication: 4, value: 4, timeliness: 3 }) },
  { businessSlug: "placeholder-plumbing-llc", reviewerName: "Mike D.", rating: 3, jobType: "Faucet repair", townName: "Hackensack, NJ", verifiedHire: false, source: "public", body: "Work was fine but the visit ran two hours late and nobody called ahead. The faucet works, pricing was fair — communication could be a lot better.", aspectsJson: JSON.stringify({ quality: 4, communication: 2, value: 4, timeliness: 2 }), ownerResponse: "You're right that we dropped the ball on the arrival window, Mike — we've added automatic on-the-way texts so this doesn't happen again. Thanks for the honest feedback.", ownerRespondedAt: "2026-08-21T10:00:00Z" },
  { businessSlug: "placeholder-plumbing-llc", reviewerName: "Elaine W.", rating: 5, jobType: "Sewer line repair", townName: "River Edge, NJ", verifiedHire: true, source: "trivetted", body: "Trenchless sewer repair saved our front yard. They handled the borough permit, finished in two days, and the crew left the site cleaner than they found it.", aspectsJson: JSON.stringify({ quality: 5, communication: 5, value: 4, timeliness: 5 }), photosJson: JSON.stringify([STOCK.sewer]) },
  { businessSlug: "placeholder-plumbing-llc", reviewerName: "Carlos G.", rating: 2, jobType: "Boiler service", townName: "Teaneck, NJ", verifiedHire: false, source: "public", body: "Quoted one price on the phone and a higher one on site. They did honor the phone quote after I pushed back, but I shouldn't have had to." },
  // example-plumbing-co
  { businessSlug: "example-plumbing-co", reviewerName: "Janet K.", rating: 5, jobType: "Repiping", townName: "Hackensack, NJ", verifiedHire: true, source: "trivetted", body: "Whole-house repipe of our 1950s colonial. Five days, dust contained, water back on every night. The crew clearly does this every week.", aspectsJson: JSON.stringify({ quality: 5, communication: 5, value: 4, timeliness: 5 }), photosJson: JSON.stringify([STOCK.repipe]) },
  { businessSlug: "example-plumbing-co", reviewerName: "Tom B.", rating: 4, jobType: "Gas line installation", townName: "Maywood, NJ", verifiedHire: true, source: "trivetted", body: "Ran a new gas line for our range and grill. Inspection passed first try. Only gripe is scheduling took two weeks in busy season.", aspectsJson: JSON.stringify({ quality: 5, communication: 4, value: 4, timeliness: 3 }), ownerResponse: "Thanks Tom — spring is our crunch season and we're adding a second licensed fitter to shorten the wait. Appreciate you trusting us with the work.", ownerRespondedAt: "2026-08-19T16:00:00Z" },
  { businessSlug: "example-plumbing-co", reviewerName: "Aisha R.", rating: 5, jobType: "Sump pump replacement", townName: "Hackensack, NJ", verifiedHire: false, source: "public", body: "Replaced our failed sump pump with a battery-backup unit right before a storm week. Basement stayed dry. Fair price, tidy work.", aspectsJson: JSON.stringify({ quality: 5, communication: 5, value: 5, timeliness: 5 }) },
  { businessSlug: "example-plumbing-co", reviewerName: "Steve L.", rating: 4, jobType: "Water heater maintenance", townName: "Teaneck, NJ", verifiedHire: true, source: "trivetted", body: "Annual flush and anode check on two heaters. On time, explained what they found, no upsell pressure.", aspectsJson: JSON.stringify({ quality: 4, communication: 5, value: 4, timeliness: 5 }) },
].map((r) => ({ moderationStatus: "published", photosJson: "", ownerResponse: "", ownerRespondedAt: "", leadId: "", reviewerEmail: "demo-reviewer@example.com", ...r }));

const DEMO_QUESTIONS = [
  { businessSlug: "placeholder-plumbing-llc", question: "Do you handle emergency calls on weekends?", askerName: "Sam", answer: "Yes — we run a 24/7 emergency line. Weekend emergency visits carry a $95 dispatch fee that's credited toward the repair if you go ahead with it.", answeredAt: "2026-08-18T12:00:00Z", moderationStatus: "published" },
  { businessSlug: "placeholder-plumbing-llc", question: "Are your plumbers background-checked and insured?", askerName: "Lauren", answer: "Every tech on your property is a W-2 employee, background-checked, and covered by our liability policy and workers' comp.", answeredAt: "2026-08-19T09:00:00Z", moderationStatus: "published" },
  { businessSlug: "example-plumbing-co", question: "Do you give free estimates for repiping?", askerName: "Victor", answer: "Yes — whole-house repiping estimates are free and include a camera inspection of the existing lines. Small-repair quotes are given over the phone.", answeredAt: "2026-08-17T15:00:00Z", moderationStatus: "published" },
].map((q) => ({ askerEmail: "demo-asker@example.com", ...q }));

const DEMO_PRICES = [
  { businessSlug: "placeholder-plumbing-llc", service: "plumbing repair", priceLabel: "$150–$400", unit: "visit", note: "most common repairs", sortOrder: 1 },
  { businessSlug: "placeholder-plumbing-llc", service: "drain cleaning", priceLabel: "$225–$450", unit: "line", sortOrder: 2 },
  { businessSlug: "placeholder-plumbing-llc", service: "water heaters", priceLabel: "from $1,850", unit: "installed", note: "40-gal gas, tank removal included", sortOrder: 3 },
  { businessSlug: "placeholder-plumbing-llc", service: "sewer line repair", priceLabel: "$3,500–$12,000", note: "trenchless where possible", sortOrder: 4 },
  { businessSlug: "placeholder-plumbing-llc", service: "leak detection", priceLabel: "$275 flat", note: "credited toward the repair", sortOrder: 5 },
  { businessSlug: "example-plumbing-co", service: "plumbing repair", priceLabel: "$135–$375", unit: "visit", sortOrder: 1 },
  { businessSlug: "example-plumbing-co", service: "repiping", priceLabel: "$8,000–$15,000", unit: "whole house", note: "PEX, fixtures extra", sortOrder: 2 },
  { businessSlug: "example-plumbing-co", service: "gas lines", priceLabel: "from $650", unit: "run", sortOrder: 3 },
  { businessSlug: "example-plumbing-co", service: "sump pumps", priceLabel: "$950–$2,400", unit: "installed", note: "battery backup at the high end", sortOrder: 4 },
];

const BUSINESS_PATCHES: Record<string, Record<string, string>> = {
  "hofmeister-plumbing": {
    highlights: "licensed,family-owned,third-generation,emergency-service",
    photosJson: JSON.stringify([HOF.van, HOF.team, HOF.castIron, HOF.heaterJob, HOF.drainJob, HOF.tubDrain]),
    // Real projects published on the client's own site (plumb-air /projects).
    projectsJson: JSON.stringify([
      { title: "Cast Iron Sewer Replacement", town: "Westwood, NJ", description: "Complete replacement of a snapped cast iron sewer stack with modern PVC piping.", photos: [HOF.castIron] },
      { title: "Water Heater Replacement", town: "Waldwick, NJ", description: "Upgraded a 40-gallon water heater to a 50-gallon gas unit for more hot water and reliability.", photos: [HOF.heaterJob] },
      { title: "Emergency Drain Cleaning", town: "Closter, NJ", description: "Cleared a severe clog affecting the entire home using hydro-jetting technology.", photos: [HOF.drainJob] },
      { title: "Tub Drain Replacement", town: "Waldwick, NJ", description: "Fixed a leaking bathtub drain by replacing the waste & overflow assembly from below.", photos: [HOF.tubDrain] },
      { title: "AC Service & Refrigerant Recharge", town: "Old Tappan, NJ", description: "Cleaned a soiled condenser coil and recharged refrigerant to restore cooling performance.", photos: [HOF.acService] },
    ]),
  },
  "placeholder-plumbing-llc": {
    services: "plumbing repair,drain cleaning,water heaters,sewer line repair,leak detection,faucet repair,boiler service",
    highlights: "licensed,insured,emergency-service,free-estimates,background-checked",
    photosJson: JSON.stringify([STOCK.waterHeater, STOCK.sewer, STOCK.ac, STOCK.furnace, STOCK.repipe]),
    projectsJson: JSON.stringify([
      { title: "Sewer line replacement (sample)", town: "Hackensack, NJ", date: "July 2026", description: "Sample before/after project card — trenchless replacement of a failed clay lateral.", beforePhoto: STOCK.sewer, afterPhoto: STOCK.repipe },
      { title: "High-efficiency water heater swap (sample)", town: "Teaneck, NJ", date: "June 2026", description: "Sample project card — 40-gallon tank to tankless conversion with new gas run.", photos: [STOCK.waterHeater, STOCK.furnace] },
    ]),
    teamJson: JSON.stringify([
      { name: "Pat Placeholder", role: "Owner · NJ Master Plumber (sample)", bio: "Sample team member — second-generation plumber, 14 years in the trade." },
      { name: "Casey Sample", role: "Service manager (sample)", bio: "Sample team member — schedules every job and runs the emergency line." },
    ]),
    faqJson: JSON.stringify([
      { q: "Do you charge for estimates?", a: "Standard repair estimates are free. Diagnostic visits for no-heat or leak calls are $95, credited toward the repair. (Sample answer.)" },
      { q: "Which towns do you serve?", a: "All of central Bergen County — Hackensack, Teaneck, Bergenfield, River Edge and neighbors. (Sample answer.)" },
      { q: "Are you licensed and insured?", a: "Yes — NJ master plumber license 36-SAMPLE-P3, fully insured. Every listing on this directory shows the registry we checked. (Sample answer.)" },
    ]),
  },
  "example-plumbing-co": {
    services: "plumbing repair,repiping,gas lines,sump pumps,water heater maintenance",
    highlights: "licensed,insured,family-owned,financing,warranty",
    photosJson: JSON.stringify([STOCK.repipe, STOCK.waterHeater, STOCK.furnace, STOCK.ac, STOCK.sewer]),
    projectsJson: JSON.stringify([
      { title: "Whole-home repipe (sample)", town: "Hackensack, NJ", date: "May 2026", description: "Sample before/after card — galvanized to PEX conversion in a 1950s colonial.", beforePhoto: STOCK.furnace, afterPhoto: STOCK.repipe },
    ]),
    teamJson: JSON.stringify([
      { name: "Alex Example", role: "Owner (sample)", bio: "Sample team member — 22 years running Example Plumbing Co." },
    ]),
    faqJson: JSON.stringify([
      { q: "Do you offer financing?", a: "Yes — 12-month same-as-cash on jobs over $2,500 through our financing partner. (Sample answer.)" },
      { q: "Is your work under warranty?", a: "Two years on labor, plus the manufacturer warranty on every fixture and appliance we install. (Sample answer.)" },
    ]),
  },
};

// ---- handlers ---------------------------------------------------------------

async function tools() {
  const { auth } = await import("@wix/essentials");
  const data: any = await import("@wix/data");
  return {
    query: auth.elevate(data.items.queryDataItems),
    insertItem: auth.elevate(data.items.insertDataItem),
    updateItem: auth.elevate(data.items.updateDataItem),
    getCollection: auth.elevate(data.collections.getDataCollection),
    createCollection: auth.elevate(data.collections.createDataCollection),
    updateCollection: auth.elevate(data.collections.updateDataCollection),
  };
}

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get("x-seed-secret") !== SEED_SECRET)
    return json({ ok: false, error: "forbidden" }, 403);
  let body: any = {};
  try {
    body = await request.json();
  } catch { /* default step */ }
  const step = body.step ?? "verify";
  const log: string[] = [];

  try {
    const t = await tools();

    if (step === "schema") {
      // 1) New collections (skip if they exist).
      for (const c of NEW_COLLECTIONS) {
        let existing: any = null;
        try {
          existing = await t.getCollection(c.id);
        } catch { /* not found */ }
        if (existing) {
          const have = new Set((existing.fields ?? []).map((f: any) => f.key));
          const missing = c.fields.filter((f) => !have.has(f.key));
          if (missing.length) {
            await t.updateCollection({ ...existing, fields: [...existing.fields, ...missing] });
            log.push(`${c.id}: added ${missing.map((f) => f.key).join(", ")}`);
          } else log.push(`${c.id}: exists, all fields present`);
        } else {
          await t.createCollection({
            _id: c.id,
            displayName: c.displayName,
            fields: c.fields,
            permissions: { insert: "ADMIN", update: "ADMIN", remove: "ADMIN", read: "ADMIN" },
          });
          log.push(`${c.id}: created`);
        }
      }
      // 2) Field additions on existing collections (append-only).
      for (const [id, fields] of Object.entries(FIELD_ADDITIONS)) {
        const existing: any = await t.getCollection(id);
        const have = new Set((existing.fields ?? []).map((f: any) => f.key));
        const missing = fields.filter((f) => !have.has(f.key));
        if (missing.length) {
          await t.updateCollection({ ...existing, fields: [...existing.fields, ...missing] });
          log.push(`${id}: added ${missing.map((f) => f.key).join(", ")}`);
        } else log.push(`${id}: all fields present`);
      }
      return json({ ok: true, log });
    }

    if (step === "seed") {
      // Idempotent: reviews keyed by businessSlug+reviewerName, questions by
      // businessSlug+question, prices by businessSlug+service.
      const existingOf = async (collection: string, _slugField: string) => {
        try {
          const res: any = await t.query({ dataCollectionId: collection }).find();
          return (res?.items ?? []).map((it: any) => ({ _id: it._id ?? it.id, ...(it.data ?? it) }));
        } catch (e: any) {
          log.push(`query ${collection} failed: ${e?.message ?? e}`);
          return [];
        }
      };
      const reviews = await existingOf("reviews", "businessSlug");
      for (const r of DEMO_REVIEWS) {
        if (reviews.some((x: any) => x.businessSlug === r.businessSlug && x.reviewerName === r.reviewerName)) continue;
        await t.insertItem({ dataCollectionId: "reviews", dataItem: { data: r } });
        log.push(`review: ${r.businessSlug} / ${r.reviewerName}`);
      }
      const questions = await existingOf("questions", "businessSlug");
      for (const q of DEMO_QUESTIONS) {
        if (questions.some((x: any) => x.businessSlug === q.businessSlug && x.question === q.question)) continue;
        await t.insertItem({ dataCollectionId: "questions", dataItem: { data: q } });
        log.push(`question: ${q.businessSlug}`);
      }
      const prices = await existingOf("servicePrices", "businessSlug");
      for (const p of DEMO_PRICES) {
        if (prices.some((x: any) => x.businessSlug === p.businessSlug && x.service === p.service)) continue;
        await t.insertItem({ dataCollectionId: "servicePrices", dataItem: { data: p } });
        log.push(`price: ${p.businessSlug} / ${p.service}`);
      }
      for (const [slug, patch] of Object.entries(BUSINESS_PATCHES)) {
        const res: any = await t.query({ dataCollectionId: "businesses" }).eq("slug", slug).find();
        const item = res?.items?.[0];
        if (!item) { log.push(`businesses: ${slug} NOT FOUND`); continue; }
        const data = item.data ?? item;
        await t.updateItem(item._id ?? item.id, {
          dataCollectionId: "businesses",
          dataItem: { data: { ...data, ...patch } },
        });
        log.push(`businesses: ${slug} patched (${Object.keys(patch).join(", ")})`);
      }
      return json({ ok: true, log });
    }

    // verify
    const counts: Record<string, string> = {};
    for (const id of ["reviews", "servicePrices", "questions"]) {
      try {
        const res: any = await t.query({ dataCollectionId: id }).find();
        counts[id] = String((res?.items ?? []).length);
      } catch (e: any) {
        counts[id] = `ERR ${e?.message ?? e}`;
      }
    }
    const biz: Record<string, string[] | string> = {};
    for (const slug of Object.keys(BUSINESS_PATCHES)) {
      try {
        const res: any = await t.query({ dataCollectionId: "businesses" }).eq("slug", slug).find();
        const data = res?.items?.[0]?.data ?? res?.items?.[0] ?? {};
        biz[slug] = ["highlights", "photosJson", "projectsJson", "teamJson", "faqJson"].filter((k) => data[k]);
      } catch (e: any) {
        biz[slug] = `ERR ${e?.message ?? e}`;
      }
    }
    return json({ ok: true, counts, biz });
  } catch (err: any) {
    console.error("admin-seed failed", err);
    return json({ ok: false, error: err?.message ?? String(err), log }, 500);
  }
};
