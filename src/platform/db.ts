/**
 * The database connection for this request. Cloudflare passes the D1 binding
 * to the middleware, which stores it here, so data code deep in src/lib can
 * reach it without threading Astro.locals through every call.
 */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

let current: D1Like | null = null;

export function setDb(db: D1Like | null | undefined) {
  if (db) current = db;
}

export function getDb(): D1Like {
  if (!current) throw new Error("The database isn't connected. Check the DB binding in wrangler.toml.");
  return current;
}
