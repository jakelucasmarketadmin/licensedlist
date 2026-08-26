import { BaseCrudService } from "@/integrations";

/**
 * Community events (C1) — collection `events`. Sources: owner/DMO submissions
 * via Jotform (moderated) and any DMO feed whose terms allow reuse
 * (docs/EVENTS-SOURCES.md — none cleared yet, so real rows start empty and
 * every module hides itself). DEMO rows render only behind ?preview=demo.
 */

export interface CommunityEvent {
  _id: string;
  title?: string;
  businessSlug?: string;
  stateSlug?: string;
  countySlug?: string;
  townSlug?: string;
  startsAt?: string | Date;
  endsAt?: string | Date;
  venue?: string;
  address?: string;
  lat?: number;
  lng?: number;
  /** display string, e.g. "Free", "$12", "$5–$20" */
  price?: string;
  url?: string;
  image?: string;
  description?: string;
  /** e.g. "owner-submission", "DEMO" */
  source?: string;
  /** pending | published | rejected */
  status?: string;
}

export const isDemoEvent = (e: CommunityEvent) => (e.source ?? "").includes("DEMO");

async function fetchAll(): Promise<CommunityEvent[]> {
  try {
    const { auth } = await import("@wix/essentials");
    const data: any = await import("@wix/data");
    const q: any = auth.elevate(data.items.query);
    const res: any = await q("events").eq("status", "published").limit(1000).find();
    return (res?.items ?? []).map((it: any) => ({ _id: it._id ?? it.id, ...(it.data ?? it) }));
  } catch {
    try {
      const result: any = await BaseCrudService.getAll("events", {}, { limit: 1000 });
      const items = Array.isArray(result) ? result : (result?.items ?? []);
      return items.filter((e: CommunityEvent) => e.status === "published");
    } catch {
      return [];
    }
  }
}

let cache: { at: number; items: CommunityEvent[] } | null = null;
const CACHE_MS = 5 * 60_000;

/** Published events with a future (or ongoing) end, soonest first. */
export async function upcomingEvents(preview = false): Promise<CommunityEvent[]> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    cache = { at: Date.now(), items: await fetchAll() };
  }
  const now = Date.now();
  return cache.items
    .filter((e) => {
      if (!preview && isDemoEvent(e)) return false;
      const end = new Date(e.endsAt ?? e.startsAt ?? 0).getTime();
      return Number.isFinite(end) && end >= now;
    })
    .sort((a, b) => new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime());
}

export async function eventsForCounty(stateSlug: string, countySlug: string, preview = false) {
  return (await upcomingEvents(preview)).filter(
    (e) => e.stateSlug === stateSlug && e.countySlug === countySlug,
  );
}

export async function eventsForTown(stateSlug: string, townSlug: string, preview = false) {
  return (await upcomingEvents(preview)).filter(
    (e) => e.stateSlug === stateSlug && e.townSlug === townSlug,
  );
}

export async function eventsForBusiness(businessSlug: string, preview = false) {
  return (await upcomingEvents(preview)).filter((e) => e.businessSlug === businessSlug);
}

/** Events starting before next Monday (i.e. through this weekend). */
export function thisWeekend(events: CommunityEvent[]): CommunityEvent[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  monday.setHours(0, 0, 0, 0);
  return events.filter((e) => new Date(e.startsAt ?? 0).getTime() < monday.getTime());
}

export function eventDateLabel(e: CommunityEvent): string {
  const s = e.startsAt ? new Date(e.startsAt) : null;
  if (!s) return "";
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  const start = s.toLocaleDateString("en-US", opts);
  const time = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${start} · ${time}`;
}

/** schema.org Event node — emitted only for real (non-DEMO) events. */
export function eventJsonLd(origin: string, e: CommunityEvent): object {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    startDate: e.startsAt ? new Date(e.startsAt).toISOString() : undefined,
    ...(e.endsAt ? { endDate: new Date(e.endsAt).toISOString() } : {}),
    ...(e.venue || e.address
      ? {
          location: {
            "@type": "Place",
            name: e.venue ?? e.address,
            ...(e.address ? { address: e.address } : {}),
          },
        }
      : {}),
    ...(e.description ? { description: e.description } : {}),
    ...(e.url ? { url: e.url } : {}),
    ...(e.image ? { image: e.image } : {}),
    eventStatus: "https://schema.org/EventScheduled",
  };
}
