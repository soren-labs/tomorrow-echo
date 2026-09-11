import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { getDb } from "../db";
import * as schema from "../db/schema";

type Auth = ReturnType<typeof createAuth>;

let auth: Auth | undefined;

function trustedOrigins(): string[] {
  const origins = new Set<string>();
  const candidates = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const withScheme = /^https?:\/\//.test(candidate) ? candidate : `https://${candidate}`;
    try {
      origins.add(new URL(withScheme).origin);
    } catch {
      // Ignore malformed URLs; Better Auth still enforces its base origin.
    }
  }
  return [...origins];
}

function createAuth() {
  return betterAuth({
    appName: "Tomorrow Echo",
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      // No email delivery in this MVP: accounts are usable immediately and
      // the UI must not claim verification.
      requireEmailVerification: false,
      autoSignIn: true,
    },
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: trustedOrigins(),
  });
}

/**
 * Lazily initialized Better Auth instance. Must not run at import time so
 * `next build` succeeds without DATABASE_URL / BETTER_AUTH_* env vars.
 */
export function getAuth() {
  if (!auth) {
    auth = createAuth();
  }
  return auth;
}
