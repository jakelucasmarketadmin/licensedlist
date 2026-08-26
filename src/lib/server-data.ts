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
  // auth.elevate must wrap the SDK functions THEMSELVES (it performs the
  // module context binding); wrapping an arbitrary closure fails with
  // "context.initWixModules(...).apply is not a function". The machine's
  // @wix/data is the new API: items.query/insert/update, flat items — the
  // `item.data ?? item` pattern at call sites covers both shapes.
  const q: any = auth.elevate(data.items.query);
  const ins: any = auth.elevate(data.items.insert);
  const upd: any = auth.elevate(data.items.update);
  return {
    query: (opts: { dataCollectionId: string }) => {
      let b: any = q(opts.dataCollectionId);
      const chain = {
        eq(k: string, v: unknown) { b = b.eq(k, v); return chain; },
        limit(n: number) { b = b.limit(n); return chain; },
        find: (): Promise<any> => b.find(),
      };
      return chain;
    },
    getItem: async (id: string, opts: { dataCollectionId: string }): Promise<any> => {
      const r = await q(opts.dataCollectionId).eq("_id", id).find();
      return r?.items?.[0] ?? null;
    },
    insertItem: (opts: { dataCollectionId: string; dataItem: { data: any } }): Promise<any> =>
      ins(opts.dataCollectionId, opts.dataItem.data),
    updateItem: (id: string, opts: { dataCollectionId: string; dataItem: { data: any } }): Promise<any> =>
      upd(opts.dataCollectionId, { ...opts.dataItem.data, _id: id }),
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
