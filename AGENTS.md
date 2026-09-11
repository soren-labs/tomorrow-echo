# Working agreement

Read docs/SPEC.md, docs/CONTRACT.md, docs/WORKSTREAMS.md and docs/ACCEPTANCE.md before implementing. This is a three-session benchmark: frontend and backend work concurrently in separate branches/PRs; a third integration session tests, merges and deploys. Follow your assigned workstream. You are not alone in the repository: do not overwrite or revert another workstream's changes. Do not push directly to main.

Use the organization's existing API default agent (SWE-2 Max); do not change models, spawn child agents, or create additional Devin sessions. The external orchestrator creates exactly the three requested sessions. Report if the selected model cannot be observed.

Use Next.js, TypeScript, Tailwind, Better Auth email/password, Drizzle and PostgreSQL. Prefer Vercel-managed Neon. Use the connected Vercel tools and existing authorized integration; inspect actual capabilities before assuming they can provision a database. Use an isolated project/database, free resources only. If external credentials, a paid plan, or unavailable permissions block provisioning, report the exact blocker after completing local work and the PR. Do not substitute mock authentication or browser storage for the real backend.

Do not implement email delivery, payments, social sharing, background jobs, AI calls, or unrelated features. Keep product copy Chinese and accessible. Never expose provider credentials or raw benchmark logs in Git, PRs, screenshots, or the website.

Every data operation must derive the user from the verified server session. Do not trust request user IDs. Use database time for the unlock rule and an atomic conditional update for settlement. Cross-user object access returns 404. No test-only authentication or clock bypass may exist in the deployed API.

Run checks appropriate to your workstream. The integration session owns full browser evidence and acceptance. Frontend/backend sessions must not merge or deploy. The integration session is authorized to merge the tested frontend/backend PRs and its own integration fixes after checks pass, and deploy the resulting main commit. Report failures honestly; do not bypass failing checks or remove protection.
