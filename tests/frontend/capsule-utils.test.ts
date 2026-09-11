import { describe, expect, it } from "vitest";
import type { Capsule } from "../../src/contracts";
import {
  clockOffsetMs,
  describeApiError,
  describeAuthError,
  formatRemaining,
  resolveBlockReason,
  validateDelay,
  validateNote,
  validateProbability,
  validateReflection,
  validateTitle,
} from "../../src/components/capsule-utils";

function capsule(partial: Partial<Capsule>): Capsule {
  return {
    id: "c1",
    title: "t",
    note: null,
    probability: 80,
    createdAt: "2026-01-01T00:00:00.000Z",
    unlockAt: "2026-01-01T00:01:00.000Z",
    state: "sealed",
    outcome: null,
    reflection: null,
    resolvedAt: null,
    score: null,
    ...partial,
  };
}

describe("formatRemaining", () => {
  it("formats days/hours/minutes/seconds in Chinese", () => {
    expect(formatRemaining((3 * 86400 + 2 * 3600) * 1000)).toBe("3 天 2 小时");
    expect(formatRemaining((5 * 3600 + 3 * 60) * 1000)).toBe("5 小时 3 分");
    expect(formatRemaining((9 * 60 + 41) * 1000)).toBe("9 分 41 秒");
    expect(formatRemaining(40 * 1000)).toBe("40 秒");
  });
  it("returns 即将揭晓 at or below zero", () => {
    expect(formatRemaining(0)).toBe("即将揭晓");
    expect(formatRemaining(-5)).toBe("即将揭晓");
  });
});

describe("clockOffsetMs", () => {
  it("computes serverNow minus local now", () => {
    const local = Date.parse("2026-01-01T00:00:10.000Z");
    expect(clockOffsetMs("2026-01-01T00:00:05.000Z", local)).toBe(-5000);
  });
  it("returns 0 for unparseable serverNow", () => {
    expect(clockOffsetMs("not-a-date")).toBe(0);
  });
});

describe("validation", () => {
  it("rejects empty and over-long titles", () => {
    expect(validateTitle("   ")).toBeTruthy();
    expect(validateTitle("x".repeat(121))).toBeTruthy();
    expect(validateTitle("今晚写完周报")).toBeNull();
  });
  it("rejects notes over 1000 chars", () => {
    expect(validateNote("x".repeat(1001))).toBeTruthy();
    expect(validateNote("")).toBeNull();
  });
  it("rejects reflections over 500 chars", () => {
    expect(validateReflection("x".repeat(501))).toBeTruthy();
    expect(validateReflection("")).toBeNull();
  });
  it("rejects non-integer or out-of-range probability", () => {
    for (const bad of ["", "-1", "101", "12.5", "abc"]) {
      expect(validateProbability(bad)).toHaveProperty("error");
    }
    expect(validateProbability("0")).toEqual({ value: 0 });
    expect(validateProbability("100")).toEqual({ value: 100 });
    expect(validateProbability("80")).toEqual({ value: 80 });
  });
  it("accepts only the four fixed delays", () => {
    for (const ok of [60, 3600, 86400, 604800]) expect(validateDelay(ok)).toBe(true);
    for (const bad of [0, 30, 3601, -60]) expect(validateDelay(bad)).toBe(false);
  });
});

describe("resolveBlockReason", () => {
  const now = Date.parse("2026-01-01T00:00:30.000Z");
  it("blocks sealed capsules with a countdown reason", () => {
    const c = capsule({ state: "sealed" });
    expect(resolveBlockReason(c, now)).toContain("还没到揭晓时间");
  });
  it("blocks resolved capsules", () => {
    const c = capsule({ state: "resolved", outcome: true, resolvedAt: "x", score: 96 });
    expect(resolveBlockReason(c, now)).toContain("已经结算");
  });
  it("allows ready capsules", () => {
    const c = capsule({ state: "ready" });
    expect(resolveBlockReason(c, now)).toBeNull();
  });
  it("allows a sealed capsule once unlockAt has passed locally", () => {
    const c = capsule({ state: "sealed" });
    expect(resolveBlockReason(c, Date.parse("2026-01-01T00:01:01.000Z"))).toBeNull();
  });
});

describe("describeApiError", () => {
  it("maps statuses to safe Chinese copy", () => {
    expect(describeApiError({ status: 0 })).toContain("网络");
    expect(describeApiError({ status: 400 })).toContain("不符合要求");
    expect(describeApiError({ status: 401 })).toContain("重新登录");
    expect(describeApiError({ status: 404 })).toContain("没有找到");
    expect(describeApiError({ status: 409 })).toContain("结算");
    expect(describeApiError({ status: 500 })).toContain("稍后重试");
    expect(describeApiError(new Error("sql syntax"))).toContain("稍后重试");
  });
});

describe("describeAuthError", () => {
  it("maps Better Auth codes", () => {
    expect(describeAuthError("INVALID_EMAIL_OR_PASSWORD")).toContain("不正确");
    expect(describeAuthError("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")).toContain("已经注册");
    expect(describeAuthError("PASSWORD_TOO_SHORT")).toContain("8 位");
    expect(describeAuthError("SOMETHING_ELSE")).toContain("失败");
    expect(describeAuthError(undefined)).toContain("失败");
  });
});
