/**
 * Lead stats for profile display. The `leads` collection is collect-content
 * (no public read), so counting runs elevated server-side and fails soft to
 * null — the "{n} people requested a quote" line simply doesn't render.
 */
export async function quoteRequestsThisMonth(businessSlug: string): Promise<number | null> {
  try {
    const { auth } = await import("@wix/essentials");
    const data: any = await import("@wix/data");
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    // Whole query inside one elevated closure (see lib/server-data.ts gotcha).
    const run = auth.elevate(() =>
      data.items.query("leads").eq("businessSlugs", businessSlug).find(),
    );
    const res: any = await run();
    const items: any[] = res?.items ?? [];
    return items.filter((it) => {
      const created = (it.data ?? it)._createdDate ?? it._createdDate;
      return created && new Date(created).getTime() >= monthStart.getTime();
    }).length;
  } catch {
    return null;
  }
}
