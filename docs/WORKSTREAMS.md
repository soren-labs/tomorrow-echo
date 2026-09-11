# Three-session experiment

| Session | Branch | Ownership | Deliverable |
| --- | --- | --- | --- |
| frontend | `devin/frontend` | `src/app/**` except `src/app/api/**`; `src/components/**`; `src/lib/auth-client.ts`; `public/**`; `tests/frontend/**`; `docs/FRONTEND.md` | UI implementation PR; typecheck/build; browser screenshots where feasible |
| backend | `devin/backend` | `src/app/api/**`; `src/lib/**` except auth-client.ts; `src/db/**`; `drizzle/**`; `scripts/db*`; `drizzle.config.ts`; `tests/backend/**`; `.env.example`; `docs/BACKEND.md` | Auth/database/API PR; unit + PostgreSQL integration tests |
| integration | `devin/integration` | Integrate the above, root config/dependency fixes, E2E tests, CI, `docs/DELIVERY.md`, Vercel/Neon deployment | passing integrated tests, merged PRs, deployed main SHA |

Do not revert files owned by the other session. Neither developer waits for the other's branch. Frontend uses the frozen HTTP contract; browser-only test mocks are allowed in test files but no mock backend is shipped. Backend uses the neutral starter homepage only to let build/typecheck run. Integration replaces no real service with mocks.

Frontend/backend do not merge or provision external services. Backend tests use a disposable local Postgres instance or CI service container. The third session starts only when both PRs are ready. It combines both branches locally, fixes conflicts, runs all acceptance, and only then merges PRs and deploys. If integration fixes are needed, commit/push fixes on the appropriate original branch before merging, or create an integration PR in an order that preserves a passing final main.

Each session uses the configured default SWE-2 Max; no additional sessions, subagents, model switches or paid service upgrades. Initial API request cap is 10 ACU per session (30 total across three); these API caps are not asserted to equal self-serve quota percentages or dollars. Report a cap/blocker before extending work. Orchestration records separate session IDs, timestamps and API responses. Review/setup consumption is kept separate from these development runs.
