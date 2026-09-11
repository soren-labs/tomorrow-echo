import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { ZodError } from "zod";

import type { CapsuleResult } from "../../../../../contracts";
import { getDb, getServerNow } from "../../../../../db";
import { capsules } from "../../../../../db/schema";
import { toCapsuleDto } from "../../../../../lib/capsules";
import {
  errorResponse,
  internalError,
  isSameOriginRequest,
  jsonResponse,
} from "../../../../../lib/http";
import { getSessionUser } from "../../../../../lib/session";
import { capsuleIdSchema, resolveCapsuleSchema } from "../../../../../lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, "unauthorized", "需要先登录");
    if (!isSameOriginRequest(request)) {
      return errorResponse(403, "forbidden", "仅允许同源请求");
    }

    const { id } = await context.params;
    if (!capsuleIdSchema.safeParse(id).success) {
      return errorResponse(404, "not_found", "内容不存在");
    }

    let input;
    try {
      input = resolveCapsuleSchema.parse(await request.json());
    } catch (error) {
      const detail = error instanceof ZodError ? error.issues[0]?.message : undefined;
      return errorResponse(400, "invalid_input", detail ?? "请求参数不合法");
    }

    const db = getDb();
    const owned = await db
      .select({ id: capsules.id })
      .from(capsules)
      .where(and(eq(capsules.id, id), eq(capsules.userId, user.id)))
      .limit(1);
    if (owned.length === 0) {
      // Nonexistent and foreign capsules are indistinguishable: no cross-user leak.
      return errorResponse(404, "not_found", "内容不存在");
    }

    // Atomic one-time settlement: exactly one concurrent writer can win.
    const [row] = await db
      .update(capsules)
      .set({
        outcome: input.outcome,
        reflection: input.reflection,
        resolvedAt: sql`now()`,
      })
      .where(
        and(
          eq(capsules.id, id),
          eq(capsules.userId, user.id),
          isNull(capsules.resolvedAt),
          lte(capsules.unlockAt, sql`now()`),
        ),
      )
      .returning();

    if (!row) {
      return errorResponse(409, "conflict", "尚未到揭晓时间或已经结算");
    }

    const now = await getServerNow(db);
    const body: CapsuleResult = {
      capsule: toCapsuleDto(row, now),
      serverNow: now.toISOString(),
    };
    return jsonResponse(body);
  } catch (error) {
    return internalError(error);
  }
}
