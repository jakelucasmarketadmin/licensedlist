import type { APIRoute } from "astro";
import { elevatedData, json } from "@/lib/server-data";
import { fetchBusinesses, categoriesOf, photosOf, projectsOf, teamOf, faqOf, parseHours, type DirectoryBusiness } from "@/lib/businesses";
import { highlightsOf } from "@/lib/reviews";

/**
 * Owner dashboard 2.0 stats (Batch E). Member-authed via approved claim.
 * Returns: 30/90-day event totals from the first-party `metrics` collection,
 * on-site review stats, an ANONYMIZED benchmark (average of up to 3 same-
 * category businesses in the same county — never named), the completeness
 * meter with the exact missing items, and the AI-visibility score with
 * ranked to-dos.
 */
async function currentMemberId(): Promise<string | null> {
  try {
    const { members } = await import("@wix/members");
    const res: any = await members.getCurrentMember();
    return res?.member?._id ?? res?._id ?? null;
  } catch {
    return null;
  }
}

const EVENTS = ["profile_view", "call_click", "website_click", "quote_started", "quote_submitted", "save", "share"] as const;

function sumWindow(rows: any[], slug: string, days: number): Record<string, number> {
  const cutoff = new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10);
  const out: Record<string, number> = Object.fromEntries(EVENTS.map((e) => [e, 0]));
  for (const r of rows) {
    if (r.businessSlug !== slug || r.day < cutoff) continue;
    if (r.event in out) out[r.event] += Number(r.count) || 0;
  }
  return out;
}

interface Todo {
  label: string;
  points: number;
}

/** Completeness + AI-visibility rubric — one source for both meters. */
function scoreBusiness(b: DirectoryBusiness, reviewCount: number) {
  const checks: { label: string; done: boolean; points: number; todo: string }[] = [
    { label: "Description (80+ chars)", done: (b.description ?? "").length >= 80, points: 10, todo: "Write a fuller description — AI assistants quote it directly." },
    { label: "Photos (3+)", done: photosOf(b).length >= 3, points: 10, todo: "Add at least 3 photos — profiles with photos get far more calls." },
    { label: "Services list", done: (b.services ?? "").trim().length > 0, points: 10, todo: "List your services — they power search matching and popular-services chips." },
    { label: "Hours", done: Boolean(parseHours(b)), points: 8, todo: "Add opening hours — enables the open-now badge." },
    { label: "Phone", done: Boolean(b.phone), points: 8, todo: "Add a phone number — calls are the top conversion." },
    { label: "Website", done: Boolean(b.website), points: 5, todo: "Add your website." },
    { label: "Highlights", done: highlightsOf(b).length > 0, points: 7, todo: "Pick highlights (family-owned, emergency service…) for the icon row." },
    { label: "Projects", done: projectsOf(b).length > 0, points: 8, todo: "Add a project with photos — before/after cards convert." },
    { label: "Team", done: teamOf(b).length > 0, points: 5, todo: "Introduce your team — faces build trust." },
    { label: "FAQ", done: faqOf(b).length > 0, points: 5, todo: "Answer 3 common questions in your FAQ." },
    { label: "License verified", done: b.licenseStatus === "verified", points: 14, todo: "Get license-verified — the strongest trust signal and AI-citation anchor." },
    { label: "On-site reviews (3+)", done: reviewCount >= 3, points: 10, todo: "Win jobs through LicensedList quotes — verified reviews unlock the rating schema AI reads." },
  ];
  const total = checks.reduce((s, c) => s + c.points, 0);
  const earned = checks.filter((c) => c.done).reduce((s, c) => s + c.points, 0);
  return {
    completeness: {
      pct: Math.round((earned / total) * 100),
      missing: checks.filter((c) => !c.done).map((c) => c.label),
    },
    aiVisibility: {
      score: Math.round((earned / total) * 100),
      todos: checks
        .filter((c) => !c.done)
        .sort((a, b) => b.points - a.points)
        .map((c) => c.todo),
    },
  };
}

export const GET: APIRoute = async () => {
  const memberId = await currentMemberId();
  if (!memberId) return json({ ok: false, error: "sign in required" }, 401);
  try {
    const { query } = await elevatedData();
    const claimsRes: any = await query({ dataCollectionId: "claims" })
      .eq("memberId", memberId)
      .eq("status", "approved")
      .find();
    const claim = claimsRes?.items?.[0]?.data ?? claimsRes?.items?.[0];
    if (!claim?.businessSlug) return json({ ok: false, error: "no approved claim" }, 403);
    const slug = claim.businessSlug as string;

    const all = await fetchBusinesses();
    const mine = all.find((b) => b.slug === slug);
    if (!mine) return json({ ok: false, error: "listing not found" }, 404);

    // Metrics (90-day window is all we need to fetch).
    const cutoff = new Date(Date.now() - 90 * 86400e3).toISOString().slice(0, 10);
    const mRes: any = await query({ dataCollectionId: "metrics" }).ge("day", cutoff).limit(1000).find();
    const metricRows: any[] = (mRes?.items ?? []).map((it: any) => it.data ?? it);

    // Reviews.
    const rRes: any = await query({ dataCollectionId: "reviews" }).eq("businessSlug", slug).find();
    const myReviews: any[] = (rRes?.items ?? [])
      .map((it: any) => it.data ?? it)
      .filter((r: any) => r.moderationStatus === "published");
    const ratings = myReviews.map((r: any) => Number(r.rating)).filter((n: number) => n >= 1);

    // Anonymized benchmark: up to 3 published same-category businesses in the
    // same county (never this one, never named).
    const myCats = categoriesOf(mine);
    const peers = all
      .filter(
        (b) =>
          b.slug !== slug &&
          b.status === "published" &&
          b.stateSlug === mine.stateSlug &&
          b.countySlug === mine.countySlug &&
          [...categoriesOf(b)].some((c) => myCats.has(c)),
      )
      .slice(0, 3);
    const benchmark30: Record<string, number> = Object.fromEntries(EVENTS.map((e) => [e, 0]));
    if (peers.length) {
      for (const p of peers) {
        const w = sumWindow(metricRows, p.slug ?? "", 30);
        for (const e of EVENTS) benchmark30[e] += w[e];
      }
      for (const e of EVENTS) benchmark30[e] = Math.round(benchmark30[e] / peers.length);
    }

    const scores = scoreBusiness(mine, myReviews.length);
    return json({
      ok: true,
      windows: { last30: sumWindow(metricRows, slug, 30), last90: sumWindow(metricRows, slug, 90) },
      reviews: {
        count: myReviews.length,
        verifiedHires: myReviews.filter((r: any) => r.verifiedHire === true || r.verifiedHire === "true").length,
        average: ratings.length ? Math.round((ratings.reduce((s: number, n: number) => s + n, 0) / ratings.length) * 10) / 10 : null,
        awaitingResponse: myReviews.filter((r: any) => !r.ownerResponse).length,
      },
      benchmark: peers.length ? { peers: peers.length, last30: benchmark30 } : null,
      ...scores,
    });
  } catch (err) {
    console.error("owner-stats failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
