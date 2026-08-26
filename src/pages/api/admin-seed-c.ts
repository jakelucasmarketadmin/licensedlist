import type { APIRoute } from "astro";
import { json } from "@/lib/server-data";

/**
 * TEMPORARY Batch C setup endpoint — create events/offers/awards/subscribers
 * collections + DEMO rows, then DELETE before publishing (same discipline as
 * the B and C0 seed endpoints).
 *
 * POST { step: "schema" | "seed" | "verify" }, header x-seed-secret.
 */
const SEED_SECRET = "tv-c-seed-2f8b4d6e1a9c3f7b5e0d8a2c6f4b9e1d";

const T = (key: string) => ({ key, type: "TEXT" });
const N = (key: string) => ({ key, type: "NUMBER" });

const COLLECTIONS = [
  {
    id: "events",
    displayName: "Events",
    fields: [
      T("title"), T("businessSlug"), T("stateSlug"), T("countySlug"), T("townSlug"),
      T("startsAt"), T("endsAt"), T("venue"), T("address"), N("lat"), N("lng"),
      T("price"), T("url"), T("image"), T("description"), T("source"), T("status"),
    ],
  },
  {
    id: "offers",
    displayName: "Offers",
    fields: [
      T("businessSlug"), T("title"), T("details"), T("terms"), T("startsAt"),
      T("expiresAt"), T("code"), T("url"), T("image"), T("status"), T("source"),
    ],
  },
  {
    id: "awards",
    displayName: "Awards",
    fields: [
      T("businessSlug"), N("year"), T("stateSlug"), T("countySlug"), T("countyName"),
      T("categorySlug"), T("status"), T("source"),
    ],
  },
  {
    id: "subscribers",
    displayName: "Subscribers",
    fields: [T("email"), T("source"), T("status")],
  },
];

function demoRows() {
  const day = 86400e3;
  const now = Date.now();
  // Next Saturday 10:00 local-ish.
  const sat = new Date(now + (((6 - new Date(now).getDay()) % 7) || 7) * day);
  sat.setHours(10, 0, 0, 0);
  const iso = (t: number) => new Date(t).toISOString();

  const events = [
    { title: "Westwood Home & Garden Fair (sample)", stateSlug: "nj", countySlug: "bergen-county", townSlug: "westwood", startsAt: iso(sat.getTime()), endsAt: iso(sat.getTime() + 8 * 3600e3), venue: "Veterans Memorial Park", address: "Westwood, NJ", lat: 40.988, lng: -74.032, price: "Free", description: "Sample event — local contractors, garden vendors, and family activities.", source: "DEMO", status: "published" },
    { title: "Ask-a-Plumber Saturday Clinic (sample)", businessSlug: "placeholder-plumbing-llc", stateSlug: "nj", countySlug: "bergen-county", townSlug: "hackensack", startsAt: iso(sat.getTime() + day + 2 * 3600e3), endsAt: iso(sat.getTime() + day + 5 * 3600e3), venue: "Placeholder Plumbing HQ", address: "Hackensack, NJ", lat: 40.8865, lng: -74.0512, price: "Free", description: "Sample event — bring your plumbing questions, get honest answers.", source: "DEMO", status: "published" },
    { title: "Bergen County Fall Home Show (sample)", stateSlug: "nj", countySlug: "bergen-county", townSlug: "hackensack", startsAt: iso(now + 16 * day), endsAt: iso(now + 18 * day), venue: "County Expo Center", address: "Hackensack, NJ", lat: 40.8859, lng: -74.043, price: "$12", description: "Sample event — three days of home-improvement exhibitors.", source: "DEMO", status: "published" },
    { title: "Teaneck Small Business Night (sample)", stateSlug: "nj", countySlug: "bergen-county", townSlug: "teaneck", startsAt: iso(now + 23 * day), venue: "Teaneck Main Street", address: "Teaneck, NJ", lat: 40.8976, lng: -74.0163, price: "Free", description: "Sample event — meet local verified businesses.", source: "DEMO", status: "published" },
  ];
  const offers = [
    { businessSlug: "placeholder-plumbing-llc", title: "$75 off any water heater install (sample)", details: "Valid on 40-gallon-plus installs booked through TriVetted.", terms: "Sample offer. One per household. Not combinable.", expiresAt: iso(now + 30 * day), code: "TRIVETTED75", status: "published", source: "DEMO" },
    { businessSlug: "example-plumbing-co", title: "Free camera inspection with drain cleaning (sample)", details: "See exactly what we cleared — recording included.", terms: "Sample offer. Residential lines only.", expiresAt: iso(now + 21 * day), status: "published", source: "DEMO" },
    { businessSlug: "demo-drains-pipes", title: "10% senior discount (sample)", details: "On all repair work, all year.", terms: "Sample offer. 65+, ID at booking.", status: "published", source: "DEMO" },
  ];
  const awards = [
    { businessSlug: "placeholder-plumbing-llc", year: 2026, stateSlug: "nj", countySlug: "bergen-county", countyName: "Bergen County", categorySlug: "plumbers", status: "published", source: "DEMO" },
  ];
  return { events, offers, awards };
}

async function tools() {
  const { auth } = await import("@wix/essentials");
  const data: any = await import("@wix/data");
  return {
    q: auth.elevate(data.items.query) as any,
    insert: auth.elevate(data.items.insert) as any,
    getCollection: auth.elevate(data.collections.getDataCollection) as any,
    createCollection: auth.elevate(data.collections.createDataCollection) as any,
  };
}

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get("x-seed-secret") !== SEED_SECRET)
    return json({ ok: false, error: "forbidden" }, 403);
  let body: any = {};
  try {
    body = await request.json();
  } catch { /* default */ }
  const step = body.step ?? "verify";
  const log: string[] = [];

  try {
    const t = await tools();

    if (step === "schema") {
      for (const c of COLLECTIONS) {
        let exists = false;
        try {
          await t.getCollection(c.id);
          exists = true;
        } catch { /* create below */ }
        if (exists) {
          log.push(`${c.id}: exists`);
          continue;
        }
        await t.createCollection({
          _id: c.id,
          displayName: c.displayName,
          fields: c.fields,
          permissions: { insert: "ADMIN", update: "ADMIN", remove: "ADMIN", read: "ADMIN" },
        });
        log.push(`${c.id}: created`);
      }
      return json({ ok: true, log });
    }

    if (step === "seed") {
      const { events, offers, awards } = demoRows();
      for (const [collection, rows, key] of [
        ["events", events, "title"],
        ["offers", offers, "title"],
        ["awards", awards, "businessSlug"],
      ] as const) {
        const res: any = await t.q(collection).limit(1000).find();
        const have = new Set((res?.items ?? []).map((it: any) => (it.data ?? it)[key]));
        for (const row of rows) {
          if (have.has((row as any)[key])) continue;
          await t.insert(collection, row);
          log.push(`${collection}: ${(row as any)[key]}`);
        }
      }
      return json({ ok: true, log });
    }

    const counts: Record<string, number | string> = {};
    for (const c of COLLECTIONS) {
      try {
        const res: any = await t.q(c.id).find();
        counts[c.id] = (res?.items ?? []).length;
      } catch (e: any) {
        counts[c.id] = `ERR ${e?.message ?? e}`;
      }
    }
    return json({ ok: true, counts });
  } catch (err: any) {
    console.error("admin-seed-c failed", err);
    return json({ ok: false, error: err?.message ?? String(err), log }, 500);
  }
};
