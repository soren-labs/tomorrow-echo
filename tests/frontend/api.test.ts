import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiRequestError } from "../../src/components/api";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api request wrapper", () => {
  it("parses the capsule list envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, { capsules: [], serverNow: "2026-01-01T00:00:00.000Z" }),
      ),
    );
    const res = await api.listCapsules();
    expect(res.capsules).toEqual([]);
    expect(res.serverNow).toBe("2026-01-01T00:00:00.000Z");
  });

  it("throws ApiRequestError with status and code on contract errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(409, { error: { code: "NOT_UNLOCKED", message: "db detail" } }),
      ),
    );
    const err = await api
      .resolveCapsule("abc", { outcome: true })
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as ApiRequestError).status).toBe(409);
    expect((err as ApiRequestError).code).toBe("NOT_UNLOCKED");
  });

  it("maps network failure to status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const err = await api.stats().then(() => null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as ApiRequestError).status).toBe(0);
  });

  it("posts the frozen create payload shape", async () => {
    const spy = vi.fn(async () =>
      jsonResponse(201, { capsule: {}, serverNow: "2026-01-01T00:00:00.000Z" }),
    );
    vi.stubGlobal("fetch", spy);
    await api.createCapsule({ title: "t", probability: 80, unlockDelaySeconds: 60 });
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/capsules");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      title: "t",
      probability: 80,
      unlockDelaySeconds: 60,
    });
  });
});
