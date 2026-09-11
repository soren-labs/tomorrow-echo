import { eq, sql } from "drizzle-orm";

import type { CapsuleStats } from "../../../contracts";
import { getDb, serverNowField } from "../../../db";
import { capsules } from "../../../db/schema";
import { errorResponse, internalError, jsonResponse } from "../../../lib/http";
import { getSessionUser } from "../../../lib/session";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, "unauthorized", "需要先登录");

    const db = getDb();
    const [stats] = await db
      .select({
        serverNow: serverNowField,
        total: sql<number>`count(*)::int`,
        sealed: sql<number>`count(*) filter (where ${capsules.resolvedAt} is null and ${capsules.unlockAt} > now())::int`,
        ready: sql<number>`count(*) filter (where ${capsules.resolvedAt} is null and ${capsules.unlockAt} <= now())::int`,
        resolved: sql<number>`count(*) filter (where ${capsules.resolvedAt} is not null)::int`,
        averageScore: sql<number | null>`avg(
          100.0 * (1.0 - power(
            ${capsules.probability}::float8 / 100.0
            - (case when ${capsules.outcome} then 1.0 else 0.0 end),
            2.0
          ))
        ) filter (where ${capsules.resolvedAt} is not null)::float8`,
      })
      .from(capsules)
      .where(eq(capsules.userId, user.id));

    const body: CapsuleStats = {
      total: stats?.total ?? 0,
      sealed: stats?.sealed ?? 0,
      ready: stats?.ready ?? 0,
      resolved: stats?.resolved ?? 0,
      // Averages are computed on unrounded scores, then rounded once.
      averageScore: stats?.averageScore == null ? null : Math.round(stats.averageScore),
      serverNow: (stats?.serverNow ?? new Date(0)).toISOString(),
    };
    return jsonResponse(body);
  } catch (error) {
    return internalError(error);
  }
}
