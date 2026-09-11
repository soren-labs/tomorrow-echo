// Integration tests: real Better Auth session flow + real PostgreSQL through
// the actual route handlers. Covers acceptance items A1–A8 at the API layer.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  BASE_URL,
  createCapsule,
  createReadyCapsule,
  getStats,
  listCapsules,
  migrateTestDb,
  resetTestDb,
  resolveCapsule,
  sessionCookie,
  signIn,
  signOut,
  signUp,
} from "./helpers";
import { POST as authRoutePOST } from "../../src/app/api/auth/[...all]/route";

const USER_A = "user-a@example.com";
const USER_B = "user-b@example.com";
const PASSWORD = "correct-horse-9";

beforeAll(async () => {
  await migrateTestDb();
});

beforeEach(async () => {
  await resetTestDb();
});

describe("auth flow", () => {
  it("serves auth through the mounted /api/auth/[...all] route", async () => {
    const response = await authRoutePOST(
      new Request(`${BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({
          email: "route-check@example.com",
          password: PASSWORD,
          name: "路由检查",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(sessionCookie(response)).toBeTruthy();
  });

  it("signs up, signs out, signs back in; wrong password rejected", async () => {
    const { response: signupRes, cookie } = await signUp(USER_A, PASSWORD);
    expect(signupRes.status).toBe(200);
    expect(cookie).toBeTruthy();

    // Session works for business API.
    const authed = await listCapsules({ cookie });
    expect(authed.status).toBe(200);

    // Sign out invalidates the session.
    const signoutRes = await signOut(cookie!);
    expect(signoutRes.status).toBe(200);
    expect((await listCapsules({ cookie })).status).toBe(401);

    // Wrong password rejected; correct password issues a fresh session.
    const bad = await signIn(USER_A, "wrong-password");
    expect(bad.response.status).toBe(401);
    expect(bad.cookie).toBeNull();

    const good = await signIn(USER_A, PASSWORD);
    expect(good.response.status).toBe(200);
    expect((await listCapsules({ cookie: good.cookie })).status).toBe(200);
  });
});

describe("authorization", () => {
  it("rejects unauthenticated reads and writes with 401", async () => {
    for (const res of [
      await listCapsules(),
      await getStats(),
      await createCapsule({
        body: { title: "x", probability: 50, unlockDelaySeconds: 60 },
      }),
      await resolveCapsule("11111111-2222-3333-4444-555555555555", {
        body: { outcome: true },
      }),
    ]) {
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBeTruthy();
    }
  });

  it("isolates users: B cannot see, stat, or resolve A's capsule", async () => {
    const a = await signUp(USER_A, PASSWORD);
    const b = await signUp(USER_B, PASSWORD, "用户B");

    const created = await createCapsule({
      cookie: a.cookie,
      body: { title: "A 的预测", probability: 70, unlockDelaySeconds: 60 },
    });
    expect(created.status).toBe(201);
    const { capsule } = await created.json();
    expect(capsule.userId).toBeUndefined();

    // B's list and stats are empty.
    const bList = await listCapsules({ cookie: b.cookie });
    expect((await bList.json()).capsules).toHaveLength(0);
    const bStats = await getStats({ cookie: b.cookie });
    expect(await bStats.json()).toMatchObject({
      total: 0,
      sealed: 0,
      ready: 0,
      resolved: 0,
      averageScore: null,
    });

    // B resolving A's capsule gets 404, not 403/401.
    await import("./helpers").then((h) => h.forceUnlock(capsule.id));
    const stolen = await resolveCapsule(capsule.id, {
      cookie: b.cookie,
      body: { outcome: true },
    });
    expect(stolen.status).toBe(404);

    // A nonexistent UUID also 404s for A.
    const missing = await resolveCapsule("11111111-2222-3333-4444-555555555555", {
      cookie: a.cookie,
      body: { outcome: true },
    });
    expect(missing.status).toBe(404);

    // Malformed id 404s instead of leaking a database error.
    const malformed = await resolveCapsule("not-a-uuid", {
      cookie: a.cookie,
      body: { outcome: true },
    });
    expect(malformed.status).toBe(404);
    expect((await malformed.json()).error.code).toBeTruthy();
  });
});

describe("capsule lifecycle", () => {
  it("creates sealed capsule, rejects early resolve with 409, resolves after unlock", async () => {
    const { cookie } = await signUp(USER_A, PASSWORD);

    const created = await createCapsule({
      cookie,
      body: {
        title: "明天 23:00 前睡觉",
        note: "可选说明",
        probability: 80,
        unlockDelaySeconds: 60,
      },
    });
    expect(created.status).toBe(201);
    const { capsule, serverNow } = await created.json();
    expect(capsule.state).toBe("sealed");
    expect(capsule.outcome).toBeNull();
    expect(capsule.score).toBeNull();
    expect(typeof serverNow).toBe("string");
    // Server computed unlock_at ≈ now + 60s, not client-supplied time.
    const delta =
      new Date(capsule.unlockAt).getTime() - new Date(serverNow).getTime();
    expect(delta).toBeGreaterThan(55_000);
    expect(delta).toBeLessThan(70_000);

    // Early resolve → 409.
    const early = await resolveCapsule(capsule.id, {
      cookie,
      body: { outcome: true },
    });
    expect(early.status).toBe(409);
    expect((await early.json()).error.code).toBeTruthy();

    // Unlock passes (test-only DB time shift, no app bypass) → resolve works.
    const helpers = await import("./helpers");
    await helpers.forceUnlock(capsule.id);
    const resolved = await resolveCapsule(capsule.id, {
      cookie,
      body: { outcome: true, reflection: "确实睡了" },
    });
    expect(resolved.status).toBe(200);
    const done = await resolved.json();
    expect(done.capsule.state).toBe("resolved");
    expect(done.capsule.outcome).toBe(true);
    expect(done.capsule.reflection).toBe("确实睡了");
    expect(done.capsule.score).toBe(96);
    expect(done.capsule.resolvedAt).toBeTruthy();

    // Double resolve → 409.
    const again = await resolveCapsule(capsule.id, {
      cookie,
      body: { outcome: false },
    });
    expect(again.status).toBe(409);
  });

  it("stores false outcomes and scores them correctly", async () => {
    const { cookie } = await signUp(USER_A, PASSWORD);
    const { body } = await createReadyCapsule(cookie, { probability: 80 });

    const res = await resolveCapsule(body.capsule.id, {
      cookie,
      body: { outcome: false },
    });
    expect(res.status).toBe(200);
    const { capsule } = await res.json();
    expect(capsule.outcome).toBe(false);
    expect(capsule.score).toBe(36);
    expect(capsule.state).toBe("resolved");

    const stats = await (await getStats({ cookie })).json();
    expect(stats).toMatchObject({
      total: 1,
      sealed: 0,
      ready: 0,
      resolved: 1,
      averageScore: 36,
    });
  });

  it("handles 0/100 probability boundaries", async () => {
    const { cookie } = await signUp(USER_A, PASSWORD);
    const cases: Array<[number, boolean, number]> = [
      [0, false, 100],
      [0, true, 0],
      [100, true, 100],
      [100, false, 0],
    ];
    for (const [probability, outcome, expected] of cases) {
      const { body } = await createReadyCapsule(cookie, { probability });
      const res = await resolveCapsule(body.capsule.id, {
        cookie,
        body: { outcome },
      });
      expect(res.status).toBe(200);
      expect((await res.json()).capsule.score).toBe(expected);
    }
  });

  it("allows exactly one winner under concurrent settlement", async () => {
    const { cookie } = await signUp(USER_A, PASSWORD);
    const { body } = await createReadyCapsule(cookie, { probability: 80 });

    const [r1, r2] = await Promise.all([
      resolveCapsule(body.capsule.id, { cookie, body: { outcome: true } }),
      resolveCapsule(body.capsule.id, { cookie, body: { outcome: false } }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const stats = await (await getStats({ cookie })).json();
    expect(stats.resolved).toBe(1);
    const list = await (await listCapsules({ cookie })).json();
    expect(list.capsules[0].outcome).not.toBeNull();
  });
});

describe("input validation", () => {
  it("rejects invalid create payloads with 400", async () => {
    const { cookie } = await signUp(USER_A, PASSWORD);
    const base = { title: "预测", probability: 50, unlockDelaySeconds: 60 };
    for (const body of [
      { ...base, probability: -1 },
      { ...base, probability: 101 },
      { ...base, probability: 1.5 },
      { ...base, title: "" },
      { ...base, title: "x".repeat(121) },
      { ...base, unlockDelaySeconds: 45 },
      { ...base, note: "x".repeat(1001) },
      { ...base, userId: "someone-else" },
      { userId: "x", title: "t", probability: 50, unlockDelaySeconds: 60 },
    ]) {
      const res = await createCapsule({ cookie, body });
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBeTruthy();
    }
    const notJson = await createCapsule({ cookie, rawBody: "not json" });
    expect(notJson.status).toBe(400);
  });

  it("rejects invalid resolve payloads with 400", async () => {
    const { cookie } = await signUp(USER_A, PASSWORD);
    const { body } = await createReadyCapsule(cookie);
    for (const payload of [
      { outcome: "yes" },
      { outcome: 1 },
      {},
      { outcome: true, reflection: "x".repeat(501) },
      { outcome: true, resolvedAt: "2000-01-01T00:00:00Z" },
    ]) {
      const res = await resolveCapsule(body.capsule.id, { cookie, body: payload });
      expect(res.status).toBe(400);
    }
  });
});

describe("response hardening", () => {
  it("sets no-store on private responses and blocks cross-site writes", async () => {
    const { cookie } = await signUp(USER_A, PASSWORD);

    const list = await listCapsules({ cookie });
    expect(list.headers.get("cache-control")).toBe("no-store");
    const stats = await getStats({ cookie });
    expect(stats.headers.get("cache-control")).toBe("no-store");

    const crossSite = await createCapsule({
      cookie,
      origin: "https://evil.example",
      body: { title: "x", probability: 50, unlockDelaySeconds: 60 },
    });
    expect(crossSite.status).toBe(403);

    const fetchSiteBlocked = await createCapsule({
      cookie,
      body: { title: "x", probability: 50, unlockDelaySeconds: 60 },
      origin: "https://evil.example",
    });
    expect(fetchSiteBlocked.status).toBe(403);
  });

  it("empty stats return averageScore null, not zero", async () => {
    const { cookie } = await signUp(USER_A, PASSWORD);
    const stats = await (await getStats({ cookie })).json();
    expect(stats).toMatchObject({
      total: 0,
      sealed: 0,
      ready: 0,
      resolved: 0,
      averageScore: null,
    });
  });

  it("lists sealed and ready capsules with correct states, newest first", async () => {
    const { cookie } = await signUp(USER_A, PASSWORD);
    await createCapsule({
      cookie,
      body: { title: "第一条", probability: 50, unlockDelaySeconds: 60 },
    });
    const { body } = await createReadyCapsule(cookie, { title: "第二条" });

    const res = await listCapsules({ cookie });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.capsules).toHaveLength(2);
    expect(data.capsules[0].id).toBe(body.capsule.id);
    const byId = Object.fromEntries(data.capsules.map((c: { id: string }) => [c.id, c]));
    expect(byId[body.capsule.id].state).toBe("ready");
    const other = data.capsules.find((c: { id: string }) => c.id !== body.capsule.id);
    expect(other.state).toBe("sealed");

    const stats = await (await getStats({ cookie })).json();
    expect(stats).toMatchObject({ total: 2, sealed: 1, ready: 1, resolved: 0 });
  });
});
