/**
 * Stand-in for @wix/data on Cloudflare. Same call shapes the site already uses
 * (items.query(...).eq().startsWith().limit().find(), insert, update, remove),
 * backed by one D1 table that stores each collection item as JSON.
 *
 * On the server it talks to D1. In the browser only `insert` exists, and it goes
 * through /api/collect, which accepts new claims and leads and nothing else —
 * the same "anyone can submit, only admins read" rule the Wix collections had.
 */
import { getDb } from "../db";

type Item = Record<string, any> & { _id: string };
type Filter = { sql: string; args: unknown[] };

const FIELD = /^[A-Za-z_][\w.]*$/;
const path = (field: string) => {
  if (!FIELD.test(field)) throw new Error(`Unsupported field name: ${field}`);
  return `json_extract(data, '$.${field}')`;
};
const like = (v: unknown) => String(v ?? "").replace(/[\\%_]/g, (c) => "\\" + c);
// JSON booleans read back from json_extract as 1 and 0.
const sqlValue = (v: unknown) => (typeof v === "boolean" ? (v ? 1 : 0) : v instanceof Date ? v.toISOString() : v);

class Query {
  private filters: Filter[] = [];
  private order: string[] = [];
  private max = 50;
  private offset = 0;
  constructor(private collection: string) {}

  private add(sql: string, ...args: unknown[]) { this.filters.push({ sql, args }); return this; }
  eq(f: string, v: unknown) { return v === null || v === undefined ? this.add(`${path(f)} IS NULL`) : this.add(`${path(f)} = ?`, sqlValue(v)); }
  ne(f: string, v: unknown) { return this.add(`(${path(f)} IS NULL OR ${path(f)} != ?)`, sqlValue(v)); }
  ge(f: string, v: unknown) { return this.add(`${path(f)} >= ?`, sqlValue(v)); }
  gt(f: string, v: unknown) { return this.add(`${path(f)} > ?`, sqlValue(v)); }
  le(f: string, v: unknown) { return this.add(`${path(f)} <= ?`, sqlValue(v)); }
  lt(f: string, v: unknown) { return this.add(`${path(f)} < ?`, sqlValue(v)); }
  startsWith(f: string, v: string) { return this.add(`${path(f)} LIKE ? ESCAPE '\\'`, like(v) + "%"); }
  endsWith(f: string, v: string) { return this.add(`${path(f)} LIKE ? ESCAPE '\\'`, "%" + like(v)); }
  contains(f: string, v: string) { return this.add(`${path(f)} LIKE ? ESCAPE '\\'`, "%" + like(v) + "%"); }
  isEmpty(f: string) { return this.add(`(${path(f)} IS NULL OR ${path(f)} = '')`); }
  isNotEmpty(f: string) { return this.add(`(${path(f)} IS NOT NULL AND ${path(f)} != '')`); }
  // Matches a scalar field equal to any value, or an array field holding any of them.
  hasSome(f: string, values: unknown[] | unknown) {
    const list = (Array.isArray(values) ? values : [values]).map(sqlValue);
    if (!list.length) return this.add("0");
    if (!FIELD.test(f)) throw new Error(`Unsupported field name: ${f}`);
    return this.add(`EXISTS (SELECT 1 FROM json_each(data, '$.${f}') WHERE value IN (${list.map(() => "?").join(",")}))`, ...list);
  }
  ascending(...fields: string[]) { for (const f of fields) this.order.push(`${path(f)} ASC`); return this; }
  descending(...fields: string[]) { for (const f of fields) this.order.push(`${path(f)} DESC`); return this; }
  limit(n: number) { this.max = Math.max(0, Math.min(5000, Number(n) || 0)); return this; }
  skip(n: number) { this.offset = Math.max(0, Number(n) || 0); return this; }
  // References aren't stored separately here, so there is nothing to join.
  include() { return this; }

  private where() {
    const sql = ["collection = ?", ...this.filters.map((f) => f.sql)].join(" AND ");
    return { sql, args: [this.collection, ...this.filters.flatMap((f) => f.args)] };
  }
  async count(): Promise<number> {
    const w = this.where();
    const row = await getDb().prepare(`SELECT COUNT(*) AS n FROM items WHERE ${w.sql}`).bind(...w.args).first<{ n: number }>();
    return Number(row?.n ?? 0);
  }
  async find() {
    const w = this.where();
    const order = this.order.length ? ` ORDER BY ${this.order.join(", ")}` : " ORDER BY created DESC";
    const { results } = await getDb()
      .prepare(`SELECT data FROM items WHERE ${w.sql}${order} LIMIT ? OFFSET ?`)
      .bind(...w.args, this.max, this.offset)
      .all<{ data: string }>();
    const rows: Item[] = results.map((r) => JSON.parse(r.data));
    const totalCount = rows.length < this.max && this.offset === 0 ? rows.length : await this.count();
    const offset = this.offset, max = this.max;
    return {
      items: rows,
      totalCount,
      length: rows.length,
      hasNext: () => offset + rows.length < totalCount,
      // Some call sites read the newer `{ data }` shape.
      dataItems: rows.map((r) => ({ id: r._id, data: r })),
      _pageSize: max,
    };
  }
}

const now = () => new Date().toISOString();
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function serverInsert(collection: string, data: Record<string, any>): Promise<Item> {
  const stamp = now();
  const item: Item = { ...data, _id: data._id || newId(), _createdDate: data._createdDate || stamp, _updatedDate: stamp };
  await getDb()
    .prepare("INSERT INTO items (collection, id, data, created, updated) VALUES (?, ?, ?, ?, ?)")
    .bind(collection, item._id, JSON.stringify(item), item._createdDate, stamp)
    .run();
  return item;
}

async function serverUpdate(collection: string, data: Record<string, any>): Promise<Item> {
  if (!data?._id) throw new Error("update needs an _id");
  const existing = await getDb().prepare("SELECT data FROM items WHERE collection = ? AND id = ?").bind(collection, data._id).first<{ data: string }>();
  const prev = existing ? JSON.parse(existing.data) : {};
  const stamp = now();
  const item: Item = { ...data, _id: data._id, _createdDate: prev._createdDate || data._createdDate || stamp, _updatedDate: stamp };
  await getDb()
    .prepare("INSERT INTO items (collection, id, data, created, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated = excluded.updated")
    .bind(collection, item._id, JSON.stringify(item), item._createdDate, stamp)
    .run();
  return item;
}

async function browserInsert(collection: string, data: Record<string, any>): Promise<Item> {
  const res = await fetch("/api/collect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ collection, item: data }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "That didn't send. Please try again.");
  return body.item;
}

const serverOnly = (name: string) => () => { throw new Error(`${name} only runs on the server.`); };
const isServer = typeof window === "undefined";

export const items: any = {
  query: isServer ? (collection: string) => new Query(collection) : serverOnly("query"),
  insert: isServer ? serverInsert : browserInsert,
  update: isServer ? serverUpdate : serverOnly("update"),
  remove: isServer
    ? async (collection: string, id: string) => { await getDb().prepare("DELETE FROM items WHERE collection = ? AND id = ?").bind(collection, id).run(); return { _id: id }; }
    : serverOnly("remove"),
  get: isServer
    ? async (collection: string, id: string) => { const r = await getDb().prepare("SELECT data FROM items WHERE collection = ? AND id = ?").bind(collection, id).first<{ data: string }>(); return r ? JSON.parse(r.data) : null; }
    : serverOnly("get"),
  // Older call shapes some routes still use.
  getDataItem: isServer
    ? async (id: string, opts: { dataCollectionId: string }) => { const r = await getDb().prepare("SELECT data FROM items WHERE collection = ? AND id = ?").bind(opts.dataCollectionId, id).first<{ data: string }>(); return r ? JSON.parse(r.data) : null; }
    : serverOnly("getDataItem"),
  updateDataItem: isServer
    ? (id: string, opts: { dataCollectionId: string; dataItem: { data: Record<string, any> } }) => serverUpdate(opts.dataCollectionId, { ...opts.dataItem.data, _id: id })
    : serverOnly("updateDataItem"),
  queryReferenced: async () => ({ items: [], totalCount: 0, hasNext: () => false }),
  insertReference: async () => {},
  removeReference: async () => {},
};
