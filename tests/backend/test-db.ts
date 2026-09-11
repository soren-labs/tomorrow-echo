/**
 * Fail-closed selection of the disposable test database.
 *
 * Backend tests migrate and TRUNCATE every auth and business table, so the
 * connection must come from TEST_DATABASE_URL — never the app's DATABASE_URL —
 * and must point at a loopback host whose database name marks it disposable.
 * This makes it impossible for the suite to reset a deployed or shared
 * database just because DATABASE_URL happened to be exported in the shell.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function resolveTestDatabaseUrl(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const value = env.TEST_DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "TEST_DATABASE_URL is required for backend tests. Point it at a " +
        "disposable local Postgres (see docs/BACKEND.md). DATABASE_URL is " +
        "deliberately never inherited so tests cannot reset a real database.",
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid connection URL.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(
      `TEST_DATABASE_URL must be a postgres:// URL, got "${url.protocol}".`,
    );
  }
  const host = url.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run backend tests against non-local host "${host}". ` +
        "Tests truncate all tables; TEST_DATABASE_URL must point at a " +
        "disposable local Postgres.",
    );
  }
  const dbName = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!/test/i.test(dbName)) {
    throw new Error(
      `Refusing to run backend tests against database "${dbName}". ` +
        'The disposable database name must contain "test" ' +
        "(e.g. tomorrow_echo_test).",
    );
  }
  return value;
}
