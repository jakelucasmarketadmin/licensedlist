/**
 * Elevated Wix Data tools for API routes. Elevation runs server-side only —
 * the collections written here (reviews, questions, leads) have no public
 * write access, so every mutation flows through these routes where flags like
 * `verifiedHire` are computed and can't be spoofed by clients.
 *
 * Gotcha: `auth.elevate()` must wrap a promise-returning function. Elevating
 * `items.queryDataItems` directly breaks (it synchronously returns a query
 * builder → "Cannot read properties of undefined (reading '__type')" at
 * find()); so `query` here collects the chain and runs the whole build+find
 * inside one elevated closure.
 */
export async function elevatedData() {
  const { auth } = await import("@wix/essentials");
  const data: any = await import("@wix/data");
  const run = <T>(fn: () => Promise<T>): Promise<T> => (auth.elevate(fn) as () => Promise<T>)();
  return {
    // Same call shape as the old data-v2 API the routes were written against,
    // backed by the new items.query/insert/update SDK (items come back FLAT —
    // the `item.data ?? item` pattern at call sites covers both).
    query: (opts: { dataCollectionId: string }) => {
      const filters: [string, unknown][] = [];
      let lim: number | null = null;
      const chain = {
        eq(k: string, v: unknown) { filters.push([k, v]); return chain; },
        limit(n: number) { lim = n; return chain; },
        find(): Promise<any> {
          return run(() => {
            let b: any = data.items.query(opts.dataCollectionId);
            for (const [k, v] of filters) b = b.eq(k, v);
            if (lim !== null) b = b.limit(lim);
            return b.find();
          });
        },
      };
      return chain;
    },
    getItem: (id: string, opts: { dataCollectionId: string }): Promise<any> =>
      run(async () => {
        const r = await data.items.query(opts.dataCollectionId).eq("_id", id).find();
        return r?.items?.[0] ?? null;
      }),
    insertItem: (opts: { dataCollectionId: string; dataItem: { data: any } }): Promise<any> =>
      run(() => data.items.insert(opts.dataCollectionId, opts.dataItem.data)),
    updateItem: (id: string, opts: { dataCollectionId: string; dataItem: { data: any } }): Promise<any> =>
      run(() => data.items.update(opts.dataCollectionId, { ...opts.dataItem.data, _id: id })),
  };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Strip control chars and clamp length — inputs land in CMS text fields. */
export const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
