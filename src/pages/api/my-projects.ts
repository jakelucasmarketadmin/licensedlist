import type { APIRoute } from "astro";
import { elevatedData, json } from "@/lib/server-data";
import { askClaude, hasAi } from "@/lib/ai";
import { fetchBusinesses } from "@/lib/businesses";
import { getCategory } from "@/lib/taxonomy";

/**
 * "My projects" (D1): the signed-in member's quote requests, matched by the
 * member's own login email against the leads they submitted. Each project:
 * the pros contacted, pipeline status, and (with ANTHROPIC_API_KEY) a short
 * AI summary. Only the caller's own leads are ever returned.
 */
async function currentMember(): Promise<{ id: string; email: string } | null> {
  try {
    const { members } = await import("@wix/members");
    const res: any = await members.getCurrentMember({ fieldsets: ["FULL"] });
    const m = res?.member ?? res;
    const email = m?.loginEmail ?? m?.contact?.emails?.[0] ?? null;
    return m?._id && email ? { id: m._id, email: String(email).toLowerCase() } : null;
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<string, string> = {
  new: "Sent — waiting for a response",
  contacted: "In conversation",
  won: "Hired ✓",
  lost: "Didn't work out",
};

export const GET: APIRoute = async () => {
  const member = await currentMember();
  if (!member) return json({ ok: false, error: "sign in required" }, 401);
  try {
    const { query } = await elevatedData();
    const res: any = await query({ dataCollectionId: "leads" }).eq("email", member.email).find();
    const leads: any[] = (res?.items ?? []).map((it: any) => ({ _id: it._id ?? it.id, ...(it.data ?? it) }));
    const all = await fetchBusinesses();

    const projects = await Promise.all(
      leads
        .sort((a, b) => new Date(b._createdDate ?? 0).getTime() - new Date(a._createdDate ?? 0).getTime())
        .slice(0, 20)
        .map(async (l) => {
          const bizSlugs = String(l.businessSlugs ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
          const pros = bizSlugs
            .map((slug: string) => all.find((b) => b.slug === slug))
            .filter(Boolean)
            .map((b: any) => ({ slug: b.slug, name: b.name, phone: b.phone ?? "" }));
          const status = String(l.status ?? "new");
          let summary: string | null = null;
          if (hasAi()) {
            summary = await askClaude({
              system: "Summarize a homeowner's service request thread in ONE plain sentence (what they need + where it stands). No names, no numbers.",
              prompt: `Request: ${String(l.message ?? "").slice(0, 300)}\nCategory: ${getCategory(l.categorySlug ?? "")?.name ?? "unknown"}\nUrgency: ${l.urgency ?? "?"}\nStatus: ${STATUS_LABEL[status] ?? status}\nReview submitted: ${l.reviewSubmittedAt ? "yes" : "no"}`,
              maxTokens: 80,
            });
          }
          return {
            id: l._id,
            message: String(l.message ?? ""),
            category: getCategory(l.categorySlug ?? "")?.name ?? "",
            urgency: l.urgency ?? "",
            status,
            statusLabel: STATUS_LABEL[status] ?? status,
            createdAt: l._createdDate ?? null,
            wonAt: l.wonAt ?? null,
            reviewSubmitted: Boolean(l.reviewSubmittedAt),
            pros,
            summary,
          };
        }),
    );
    return json({ ok: true, projects });
  } catch (err) {
    console.error("my-projects failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
