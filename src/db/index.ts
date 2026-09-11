import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let db: Database | undefined;

/**
 * Lazily created node-postgres connection. Works identically against Neon
 * (sslmode in the URL) and a disposable local PostgreSQL used by tests.
 * Must not run at import time so `next build` succeeds without DATABASE_URL.
 */
export function getDb(): Database {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
  }
  return db;
}

/** node-postgres returns a bare `now()` as text; map it to a Date. */
export const serverNowField = sql<Date>`now()`.mapWith(
  (value) => new Date(value as string),
);

export async function getServerNow(db: Database): Promise<Date> {
  const result = await db.execute(sql`select now() as now`);
  const value = result.rows[0].now;
  return value instanceof Date ? value : new Date(value as string);
}
