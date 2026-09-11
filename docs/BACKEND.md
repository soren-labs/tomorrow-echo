# Backend notes

Backend workstream (`devin/backend`) owns: `src/app/api/**`, `src/lib/**`
(except `auth-client.ts`), `src/db/**`, `drizzle/**`, `scripts/db*`,
`drizzle.config.ts`, `tests/backend/**`, `.env.example`, this file.

## Stack

- **Auth**: Better Auth 1.7 (`src/lib/auth.ts`), email + password only.
  `getAuth()` is lazily initialized so `next build` never touches the
  database or env vars at import time. Mounted at `src/app/api/auth/[...all]/route.ts`
  via `toNextJsHandler`. Official auth tables (`user`, `session`,
  `account`, `verification`) are generated in `src/db/schema.ts`.
- **Persistence**: node-postgres `Pool` + Drizzle (`src/db/index.ts`,
  lazily created `getDb()`). Works against Neon (`?sslmode=require` in
  `DATABASE_URL`) and a disposable local PostgreSQL for tests.
- **Validation**: Zod 4 (`src/lib/validation.ts`), strict objects so
  client-supplied `userId`/`score`/`resolvedAt` are rejected outright.

## Data model

`capsules` (`src/db/schema.ts`): `id` uuid PK, `user_id` → `user.id`
cascade, `title` 1–120, `note` ≤1000 nullable, `probability` int 0–100,
`created_at`/`unlock_at` timestamptz (database `now()`), `outcome`
nullable boolean, `reflection` ≤500 nullable, `resolved_at` nullable.
Checks enforce length/range and the `outcome`/`resolved_at`
both-set-or-both-null invariant (plus `reflection` only when resolved).
Index on `(user_id, created_at)`.

State is derived, never stored: `resolved_at != null` → `resolved`,
`now() >= unlock_at` → `ready`, else `sealed`.

Score is derived: `round(100 * (1 - (p - y)^2))`, `p = probability/100`,
`y = 1|0` (`outcome=false` is a real result worth 36 at p=0.8). Stats
average over unrounded scores, then round once.

## HTTP surface (see docs/CONTRACT.md)

| Route | Notes |
| --- | --- |
| `GET /api/capsules` | `{capsules, serverNow}`, newest first, 401 unauthenticated |
| `POST /api/capsules` | `{title, note?, probability, unlockDelaySeconds}` → 201; delay ∈ {60, 3600, 86400, 604800}; `unlock_at` = DB `now() + delay` |
| `POST /api/capsules/:id/resolve` | `{outcome, reflection?}` → 200; 404 foreign/missing/malformed id, 409 early/already-resolved |
| `GET /api/stats` | `{total, sealed, ready, resolved, averageScore|null, serverNow}` |

Errors: `{error: {code, message}}`. 401 unauthorized · 400 invalid_input ·
403 forbidden (cross-origin writes: Origin host mismatch or
`Sec-Fetch-Site` not `same-origin`/`none`) · 404 not_found · 409
conflict · 500 internal_error. All responses are `Cache-Control:
no-store`; capsule payloads never include `userId`.

Settlement is a single atomic statement:
`UPDATE ... WHERE id AND user_id AND resolved_at IS NULL AND unlock_at <= now()`
so exactly one concurrent resolve wins. Identity always comes from
`auth.api.getSession(request.headers)` — never from the request body.
No time/auth bypasses exist; tests may only shift `unlock_at` inside the
disposable test database.

## Environment

`.env` (git-ignored) — see `.env.example`:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection (Neon or local) |
| `BETTER_AUTH_SECRET` | ≥32-char session secret |
| `BETTER_AUTH_URL` | App base URL, e.g. `http://localhost:3000` |

`VERCEL_URL`/`NEXT_PUBLIC_APP_URL` are additionally honored for
`trustedOrigins` when present. Integration owns provisioning.

## Commands

```bash
npm ci
npm run db:migrate        # apply drizzle/*.sql via scripts/db-migrate.ts
npm run test:backend      # vitest unit + real-Postgres integration tests
npm run typecheck && npm run lint && npm run build
```

Migrations are generated with `npx drizzle-kit generate` from
`src/db/schema.ts` and applied once per environment — never per request.

### Local test database

Backend tests use a dedicated, disposable database selected by
`TEST_DATABASE_URL` (see `.env.test.example`) — `DATABASE_URL` is never
inherited, so an exported production URL cannot leak into the suite.
`tests/backend/test-db.ts` fails closed unless the URL is a `postgres://`
DSN on a loopback host (`localhost`/`127.0.0.1`/`::1`) whose database name
contains `test`. The suite migrates and TRUNCATEs every auth and business
table, so it must never run against a deployed or shared database.

Any throwaway Postgres works, e.g.:

```bash
docker run -d --name te-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tomorrow_echo_test -p 5432:5432 postgres:16-alpine
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/tomorrow_echo_test \
  npm test
```

CI provides the same database via a `postgres:16-alpine` service container
(`.github/workflows/ci.yml`). Test-only `BETTER_AUTH_SECRET`/
`BETTER_AUTH_URL` defaults are set inside `tests/backend/helpers.ts`; each
test file re-migrates and truncates between cases. Integration tests drive
the real Better Auth handler (`sign-up/email`, `sign-in/email`, `sign-out`)
plus the real route handlers — no mocks.
