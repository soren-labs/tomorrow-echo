// Shared helpers for backend integration tests. These run against a real,
// disposable PostgreSQL database and the real Better Auth request handler —
// no mocks.

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5432/tomorrow_echo_test";
process.env.BETTER_AUTH_SECRET ??=
  "tomorrow-echo-test-secret-0123456789abcdef";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

export const BASE_URL = process.env.BETTER_AUTH_URL;

import { getDb } from "../../src/db";
import { getAuth } from "../../src/lib/auth";
import {
  GET as listCapsulesHandler,
  POST as createCapsuleHandler,
} from "../../src/app/api/capsules/route";
import { POST as resolveCapsuleHandler } from "../../src/app/api/capsules/[id]/resolve/route";
import { GET as statsHandler } from "../../src/app/api/stats/route";

export async function migrateTestDb() {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
}

export async function resetTestDb() {
  await getDb().execute(
    sql`truncate table "capsules", "session", "account", "verification", "user" restart identity cascade`,
  );
}

export function sessionCookie(response: Response): string | null {
  for (const cookie of response.headers.getSetCookie()) {
    if (cookie.startsWith("better-auth.session_token=")) {
      return cookie.split(";")[0];
    }
  }
  return null;
}

async function authPost(path: string, body: unknown, cookie?: string | null) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: BASE_URL,
  });
  if (cookie) headers.set("cookie", cookie);
  return getAuth().handler(
    new Request(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

export async function signUp(
  email: string,
  password = "correct-horse-9",
  name = "测试用户",
) {
  const response = await authPost("/api/auth/sign-up/email", {
    email,
    password,
    name,
  });
  return { response, cookie: sessionCookie(response) };
}

export async function signIn(email: string, password: string) {
  const response = await authPost("/api/auth/sign-in/email", {
    email,
    password,
  });
  return { response, cookie: sessionCookie(response) };
}

export async function signOut(cookie: string) {
  return authPost("/api/auth/sign-out", {}, cookie);
}

type ApiInit = {
  method?: string;
  cookie?: string | null;
  body?: unknown;
  rawBody?: string;
  origin?: string | null;
};

function apiRequest(path: string, init: ApiInit = {}): Request {
  const headers = new Headers();
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.origin !== null) headers.set("origin", init.origin ?? BASE_URL);
  let body: string | undefined;
  if (init.rawBody !== undefined) {
    body = init.rawBody;
    headers.set("content-type", "application/json");
  } else if (init.body !== undefined) {
    body = JSON.stringify(init.body);
    headers.set("content-type", "application/json");
  }
  return new Request(`${BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers,
    body,
  });
}

export const listCapsules = (init?: ApiInit) =>
  listCapsulesHandler(apiRequest("/api/capsules", init));

export const createCapsule = (init?: ApiInit) =>
  createCapsuleHandler(apiRequest("/api/capsules", { method: "POST", ...init }));

export const resolveCapsule = (id: string, init?: ApiInit) =>
  resolveCapsuleHandler(
    apiRequest(`/api/capsules/${id}/resolve`, { method: "POST", ...init }),
    { params: Promise.resolve({ id }) },
  );

export const getStats = (init?: ApiInit) =>
  statsHandler(apiRequest("/api/stats", init));

/** Test-only escape hatch allowed by the acceptance rules: move a capsule's
 * unlock time into the past inside the disposable test database. */
export async function forceUnlock(id: string) {
  await getDb().execute(
    sql`update "capsules" set unlock_at = now() - interval '1 second' where id = ${id}`,
  );
}

export async function createReadyCapsule(
  cookie: string | null,
  overrides: Record<string, unknown> = {},
) {
  const created = await createCapsule({
    cookie,
    body: {
      title: "一条测试预测",
      probability: 80,
      unlockDelaySeconds: 60,
      ...overrides,
    },
  });
  const body = await created.json();
  if (created.status === 201) {
    await forceUnlock(body.capsule.id);
  }
  return { response: created, body };
}
