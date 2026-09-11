# Frozen frontend/backend contract

All JSON keys use camelCase. Dates are ISO-8601 UTC strings. All fetches are same-origin with session cookies. Read the shared TypeScript definitions in `src/contracts.ts`.

## Business API

- `GET /api/capsules` → 200 `{ capsules: Capsule[], serverNow: string }`, newest first.
- `POST /api/capsules` body `{title, note?, probability, unlockDelaySeconds}` → 201 `{capsule: Capsule, serverNow: string}`.
- `POST /api/capsules/:id/resolve` body `{outcome: boolean, reflection?: string}` → 200 `{capsule: Capsule, serverNow: string}`.
- `GET /api/stats` → 200 `{total: number, sealed: number, ready: number, resolved: number, averageScore: number|null, serverNow: string}`.
- Errors → `{error: {code: string, message: string}}` with 400/401/404/409/500 as specified. Frontend displays safe Chinese messages, never raw database errors.

`Capsule`: `id`, `title`, `note` (string|null), `probability` (0..100 integer), `createdAt`, `unlockAt`, `state` ('sealed'|'ready'|'resolved'), `outcome` (boolean|null), `reflection` (string|null), `resolvedAt` (string|null), `score` (number|null). The API never emits userId.

## Auth

Backend exports a lazily initialized `getAuth()` from `src/lib/auth.ts`, mounts Better Auth in `src/app/api/auth/[...all]/route.ts`, and uses real PostgreSQL-backed sessions.

Frontend owns `src/lib/auth-client.ts`, created with `createAuthClient` from `better-auth/react`, default same-origin base URL. Use `authClient.signUp.email({name, email, password})`, `signIn.email({email, password})`, `signOut()` and `useSession()` according to the installed SDK. The UI collects a display name on sign-up. Auth errors follow Better Auth's native format and are handled separately from business errors.

Frontend must not import backend modules or require server auth stubs. Protect the user experience client-side by redirecting unauthenticated users to login; the backend independently enforces every API permission.

## Environment

Backend: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Production URL and trusted origins configured precisely; no wildcard origins. Frontend requires no secret env variables. Integration configures Vercel/Neon environments. `DATABASE_URL` absence must not cause import-time failure of `next build`.

Shared root dependencies and configs are preinstalled. Frontend/backend should not edit `src/contracts.ts`, package.json or package-lock.json. If an additional dependency is essential, record it in your delivery notes for integration. Avoid such additions for this MVP.
