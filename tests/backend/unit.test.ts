import { describe, expect, it } from "vitest";

import { capsuleState, computeScore, toCapsuleDto } from "../../src/lib/capsules";
import { isSameOriginRequest } from "../../src/lib/http";
import {
  capsuleIdSchema,
  createCapsuleSchema,
  resolveCapsuleSchema,
} from "../../src/lib/validation";
import type { CapsuleRow } from "../../src/db/schema";

describe("computeScore", () => {
  it.each([
    [80, true, 96],
    [80, false, 36],
    [0, true, 0],
    [0, false, 100],
    [100, true, 100],
    [100, false, 0],
    [50, true, 75],
    [50, false, 75],
    [60, true, 84],
  ])("probability=%i outcome=%s -> %i", (probability, outcome, score) => {
    expect(computeScore(probability, outcome)).toBe(score);
  });
});

describe("capsuleState", () => {
  const base = { resolvedAt: null as Date | null, unlockAt: new Date("2030-01-01T00:00:00Z") };

  it("is resolved once resolved_at is set", () => {
    expect(capsuleState({ ...base, resolvedAt: new Date() }, new Date())).toBe("resolved");
  });

  it("is ready when database time reaches unlock_at", () => {
    expect(capsuleState(base, new Date("2030-01-01T00:00:00Z"))).toBe("ready");
  });

  it("is sealed before unlock_at", () => {
    expect(capsuleState(base, new Date("2029-12-31T23:59:59Z"))).toBe("sealed");
  });
});

describe("toCapsuleDto", () => {
  const row: CapsuleRow = {
    id: "11111111-2222-3333-4444-555555555555",
    userId: "user-secret",
    title: "预测",
    note: null,
    probability: 80,
    createdAt: new Date("2030-01-01T00:00:00Z"),
    unlockAt: new Date("2030-01-01T01:00:00Z"),
    outcome: false,
    reflection: null,
    resolvedAt: new Date("2030-01-01T02:00:00Z"),
  };

  it("emits contract fields, preserves false outcome, never leaks userId", () => {
    const dto = toCapsuleDto(row, new Date("2030-01-01T03:00:00Z"));
    expect(dto).toEqual({
      id: row.id,
      title: "预测",
      note: null,
      probability: 80,
      createdAt: "2030-01-01T00:00:00.000Z",
      unlockAt: "2030-01-01T01:00:00.000Z",
      state: "resolved",
      outcome: false,
      reflection: null,
      resolvedAt: "2030-01-01T02:00:00.000Z",
      score: 36,
    });
    expect("userId" in dto).toBe(false);
  });
});

describe("createCapsuleSchema", () => {
  const valid = { title: "预测", probability: 80, unlockDelaySeconds: 60 };

  it("accepts a valid payload", () => {
    expect(createCapsuleSchema.parse(valid)).toEqual({ ...valid, note: null });
  });

  // Postgres char_length() counts characters; 61 emoji are 61 characters
  // but 122 UTF-16 code units, so a .length-based check would reject them.
  it.each([
    [{ ...valid, title: "🙂".repeat(120) }],
    [{ ...valid, note: "🙂".repeat(1000) }],
  ])("accepts in-limit supplementary-plane input %j", (payload) => {
    expect(createCapsuleSchema.safeParse(payload).success).toBe(true);
  });

  it.each([
    [{ ...valid, title: "🙂".repeat(121) }],
    [{ ...valid, note: "🙂".repeat(1001) }],
  ])("rejects over-limit supplementary-plane input %j", (payload) => {
    expect(createCapsuleSchema.safeParse(payload).success).toBe(false);
  });

  it.each([
    [{ ...valid, probability: -1 }],
    [{ ...valid, probability: 101 }],
    [{ ...valid, probability: 80.5 }],
    [{ ...valid, probability: "80" }],
    [{ ...valid, title: "" }],
    [{ ...valid, title: "   " }],
    [{ ...valid, title: "x".repeat(121) }],
    [{ ...valid, unlockDelaySeconds: 30 }],
    [{ ...valid, unlockDelaySeconds: 120 }],
    [{ ...valid, unlockDelaySeconds: "60" }],
    [{ ...valid, userId: "attacker" }],
    [{ ...valid, score: 100 }],
    [{ ...valid, note: "x".repeat(1001) }],
  ])("rejects %j", (payload) => {
    expect(createCapsuleSchema.safeParse(payload).success).toBe(false);
  });
});

describe("resolveCapsuleSchema", () => {
  it.each([
    [{ outcome: true }],
    [{ outcome: false, reflection: "复盘" }],
    [{ outcome: true, reflection: "🙂".repeat(500) }],
  ])("accepts %j", (payload) => {
    expect(resolveCapsuleSchema.safeParse(payload).success).toBe(true);
  });

  it.each([
    [{ outcome: "yes" }],
    [{ outcome: 1 }],
    [{}],
    [{ outcome: true, reflection: "x".repeat(501) }],
    [{ outcome: true, reflection: "🙂".repeat(501) }],
    [{ outcome: true, userId: "attacker" }],
    [{ outcome: true, resolvedAt: "2000-01-01T00:00:00Z" }],
  ])("rejects %j", (payload) => {
    expect(resolveCapsuleSchema.safeParse(payload).success).toBe(false);
  });
});

describe("capsuleIdSchema", () => {
  it("accepts UUIDs", () => {
    expect(capsuleIdSchema.safeParse("11111111-2222-3333-4444-555555555555").success).toBe(true);
  });
  it.each([["not-a-uuid"], ["123"], ["../../../etc/passwd"]])("rejects %s", (id) => {
    expect(capsuleIdSchema.safeParse(id).success).toBe(false);
  });
});

describe("isSameOriginRequest", () => {
  const make = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/capsules", { method: "POST", headers });

  it("allows same-origin and headerless requests", () => {
    expect(isSameOriginRequest(make({ origin: "http://localhost:3000" }))).toBe(true);
    expect(isSameOriginRequest(make({}))).toBe(true);
    expect(
      isSameOriginRequest(make({ "sec-fetch-site": "same-origin" })),
    ).toBe(true);
  });

  it("rejects cross-origin and cross-site writes", () => {
    expect(isSameOriginRequest(make({ origin: "https://evil.example" }))).toBe(false);
    expect(isSameOriginRequest(make({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(make({ "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isSameOriginRequest(make({ origin: "not a url" }))).toBe(false);
  });

  it("rejects a cross-scheme origin even when the host matches", () => {
    // http page must not write to the https endpoint on the same host.
    expect(isSameOriginRequest(make({ origin: "https://localhost:3000" }))).toBe(false);
    expect(
      isSameOriginRequest(
        make({
          origin: "https://app.example",
          "x-forwarded-host": "app.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(true);
    expect(
      isSameOriginRequest(
        make({
          origin: "http://app.example",
          "x-forwarded-host": "app.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(false);
  });
});
