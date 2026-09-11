import { desc, eq, sql } from "drizzle-orm";
import { ZodError } from "zod";

import type { CapsuleList, CapsuleResult } from "../../../contracts";
import { getDb, getServerNow, serverNowField } from "../../../db";
import { capsules } from "../../../db/schema";
import { toCapsuleDto } from "../../../lib/capsules";
import {
  errorResponse,
  internalError,
  isSameOriginRequest,
  jsonResponse,
} from "../../../lib/http";
import { getSessionUser } from "../../../lib/session";
import { createCapsuleSchema } from "../../../lib/validation";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, "unauthorized", "需要先登录");

    const db = getDb();
    const rows = await db
      .select({ capsule: capsules, serverNow: serverNowField })
      .from(capsules)
      .where(eq(capsules.userId, user.id))
      .orderBy(desc(capsules.createdAt), desc(capsules.id));

    const now = rows[0]?.serverNow ?? (await getServerNow(db));
    const body: CapsuleList = {
      capsules: rows.map(({ capsule }) => toCapsuleDto(capsule, now)),
      serverNow: now.toISOString(),
    };
    return jsonResponse(body);
  } catch (error) {
    return internalError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, "unauthorized", "需要先登录");
    if (!isSameOriginRequest(request)) {
      return errorResponse(403, "forbidden", "仅允许同源请求");
    }

    let input;
    try {
      input = createCapsuleSchema.parse(await request.json());
    } catch (error) {
      const detail = error instanceof ZodError ? error.issues[0]?.message : undefined;
      return errorResponse(400, "invalid_input", detail ?? "请求参数不合法");
    }

    const db = getDb();
    const [row] = await db
      .insert(capsules)
      .values({
        userId: user.id,
        title: input.title,
        note: input.note,
        probability: input.probability,
        unlockAt: sql`now() + (${input.unlockDelaySeconds} * interval '1 second')`,
      })
      .returning();

    const now = await getServerNow(db);
    const body: CapsuleResult = {
      capsule: toCapsuleDto(row, now),
      serverNow: now.toISOString(),
    };
    return jsonResponse(body, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
