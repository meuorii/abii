# Abii Admin Dashboard — Lean Codex Workflow

**Purpose:** Minimize repeated context and unnecessary tool output across the 12-phase implementation without weakening security, functionality, or tests.

## 1. Session startup (smallest useful context)

1. Run `git status --short` and `git diff --stat`; inspect staged changes and untracked filenames too. **Never discard or overwrite existing work.**
2. Read this file and only the relevant headings of `docs/ADMIN_DASHBOARD_IMPLEMENTATION.md`. Open `docs/ADMIN_OPERATOR.md` only for provisioning/deployment questions.
3. Trace affected imports, call sites, tests, and schema definitions. Do **not** dump the source tree, full handoff, or whole file contents unless necessary.
4. Treat prior notes and uploaded snapshots as hints; the **actual working tree** is authoritative.

## 2. Skills and implementation discipline

- Use **one primary skill and at most one supporting skill per stage**. For Phase 2, pair `graphify` with `api-security` for dependency review, `mongodb-mongoose` with `ponytail` for the singleton and setup, and `api-security` with `mongodb-mongoose` for authentication review and validation.
- Apply Ponytail principles: smallest complete, readable, well-tested solution. Do not remove security controls, audit guarantees, validation, or tests to save tokens.
- Follow `graphify`'s narrow lookup guidance. Use an existing working index if available, or trace targeted `rg` results and imports. Avoid installing or generating an index for a narrow review.
- Avoid broad refactors, new dependencies, speculative abstractions, and unrelated formatting.
- Make **one cohesive, reviewable change** at a time; implement and verify before expanding scope.

## 3. Validation cadence

- After each narrow change: run only affected tests and TypeScript checks when relevant.
- At the **Phase 2 completion gate**, run `npm run test:admin-security`, `npm run test:auth-login`, `npm run test:auth-email`, `npm run typecheck`, `npm run lint`, and `npm run build` (adapt commands to the installed shell); capture actual outcomes.
- The composite `npm test` includes demo-seed application logic: inspect and obtain explicit authorization before invoking it. Never target production or a live user database for tests.
- Use an isolated MongoDB replica set for uniqueness, transaction, MFA replay, and concurrent provisioning tests. A mocked test cannot prove the live index exists.
- Keep command outputs concise; on failure, inspect only the relevant error sections. Do not rerun passing checks unless changes affect them.

## 4. Safety and Git discipline

- Preserve all existing uncommitted changes, including user artwork and `skills-lock.json`.
- Do not reset, clean, force-push, stash, or commit unrelated work. Create a milestone commit **only with explicit user authorization**, after reviewing exactly what will be staged.
- Never run private admin provisioning, index mutation, key rotation, credential recovery, or production data changes on a real deployment without separate operator approval.
- Never reveal secrets, passwords, recovery codes, OTP values, tokens, or connection strings in output or handoffs.
- Do not begin another phase automatically.

## 5. Active handoff

**Status** Phase 8 implemented. Production activation remains pending.

**Verified now** Count-bearing forward authentication evidence, independent transactional audit history, bounded summaries, warning rules, exact-ID search, encrypted cursor pagination and safe details.

**Files changed** `app/(admin)/admin/{loading.tsx,security/page.tsx}`, `app/api/{account/password,auth/{login,verify-email,forgot-password/{verify,reset}}}/route.ts`, `components/admin/{admin-page,admin-security,security-evidence-table}.tsx`, `lib/admin/{security,security-contract}.ts`, `lib/auth/{admin-audit,admin-factor,admin-session-state,rate-limit,security-evidence}.ts`, `models/AdminAuditLog.ts`, `scripts/{admin-security-logs.test.ts,admin-ui.browser.mjs}`, `package.json`, `docs/{ADMIN_CODEX_WORKFLOW,ADMIN_DASHBOARD_IMPLEMENTATION}.md`.

**Tests** Focused security logs, administrator security, Users, Overview, login and email authentication, TypeScript, lint and the loopback-isolated production build passed in isolation. Three existing lint warnings remain.

**Browser QA** Full admin suite passed. Security fit at all eight requested widths with keyboard chart inspection, cursor navigation, exact-ID search, sheet focus restoration, empty and partial reads, and login success during a rejected diagnostic write.

**Deployment gates** Approve the existing retention and new explorer indexes, verify staging query plans and diagnostic failure isolation, and enable `ABII_SECURITY_EVENTS_ENABLED` at an agreed UTC time. Production indexes were not inspected or changed.

**Next task** Run the documented security index and event-delivery checks against approved staging storage.

## 6. Update this compact handoff at the end of each task

Replace the **Active handoff** section above with a concise factual update (aim for **under 20 lines**):

- **Status:** Done / Partial / Blocked
- **Verified now:** Requirements and tests actually completed
- **Files changed:** Paths only
- **Remaining:** Prioritized next 1–3 gaps
- **Blockers / deployment gates:** Facts, not guesses
- **Next task:** One specific bounded action

Avoid long transcripts, pasted diffs, repeated architecture explanations, and full test logs. Keep `docs/ADMIN_DASHBOARD_IMPLEMENTATION.md` as the detailed long-term roadmap; update its phase status only when evidence supports it.
