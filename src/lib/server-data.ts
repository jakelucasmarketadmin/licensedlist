/**
 * Elevated Wix Data tools for API routes. Elevation runs server-side only —
 * the collections written here (reviews, questions, leads) have no public
 * write access, so every mutation flows through these routes where flags like
 * `verifiedHire` are computed and can't be spoofed by clients.
 */
export async function elevatedData() {
  const { auth } = await import("@wix/essentials");
  const data: any = await import("@wix/data");
  return {
    query: auth.elevate(data.items.queryDataItems),
    getItem: auth.elevate(data.items.getDataItem),
    insertItem: auth.elevate(data.items.insertDataItem),
    updateItem: auth.elevate(data.items.updateDataItem),
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
