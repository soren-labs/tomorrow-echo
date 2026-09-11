import { describe, expect, it } from "vitest";

import { resolveTestDatabaseUrl } from "./test-db";

describe("resolveTestDatabaseUrl", () => {
  it("accepts a disposable local test database", () => {
    const url = "postgres://postgres:postgres@localhost:5432/tomorrow_echo_test";
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: url })).toBe(url);
    expect(
      resolveTestDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/int_test_db",
      }),
    ).toContain("127.0.0.1");
  });

  it("fails closed when TEST_DATABASE_URL is missing or empty", () => {
    expect(() => resolveTestDatabaseUrl({})).toThrow(/TEST_DATABASE_URL/);
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: "  " })).toThrow(
      /TEST_DATABASE_URL/,
    );
  });

  it("refuses non-postgres URLs", () => {
    expect(() =>
      resolveTestDatabaseUrl({
        TEST_DATABASE_URL: "http://localhost:5432/tomorrow_echo_test",
      }),
    ).toThrow(/postgres/);
  });

  it("refuses remote hosts so tests can never truncate a deployed database", () => {
    const remote =
      "postgres://u:p@ep-example-123.us-east-2.aws.neon.tech/tomorrow_echo_test?sslmode=require";
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: remote })).toThrow(
      /non-local/,
    );
    expect(() =>
      resolveTestDatabaseUrl({
        TEST_DATABASE_URL: "postgres://u:p@db.internal:5432/tomorrow_echo_test",
      }),
    ).toThrow(/non-local/);
  });

  it("refuses local databases whose name does not mark them disposable", () => {
    expect(() =>
      resolveTestDatabaseUrl({
        TEST_DATABASE_URL:
          "postgres://postgres:postgres@localhost:5432/tomorrow_echo",
      }),
    ).toThrow(/test/i);
    expect(() =>
      resolveTestDatabaseUrl({
        TEST_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/postgres",
      }),
    ).toThrow(/test/i);
  });
});
