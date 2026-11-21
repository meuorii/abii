# Abii Admin Dashboard — Lean Codex Workflow

**Purpose:** Minimize repeated context and unnecessary tool output across the 12-phase implementation without weakening security, functionality, or tests.

## 1. Session startup (smallest useful context)

1. Run `git status --short` and `git diff --stat`; inspect staged changes and untracked filenames too. **Never discard or overwrite existing work.**
2. Read this file and only the relevant headings of `docs/ADMIN_DASHBOARD_IMPLEMENTATION.md`. Open `docs/ADMIN_OPERATOR.md` only for provisioning/deployment questions.
3. Trace affected imports, call sites, tests, and schema definitions. Do **not** dump the source tree, full handoff, or whole file contents unless necessary.
4. Treat prior notes and uploaded snapshots as hints; the **actual working tree** is authoritative.

## 2. Skills and implementation discipline

- Default to **one primary skill and at most one supporting skill per task**. For Phase 2: `api-security` + `mongodb-mongoose` when needed; substitute `backend-architecture` if the task concerns service/session boundaries. Do not repeatedly load skill instructions that are already available in the current session.
- Apply Ponytail principles: smallest complete, readable, well-tested solution. Do not remove security controls, audit guarantees, validation, or tests to save tokens.
- Graphify is optional: use an existing working index if available; otherwise use targeted `rg`/imports. Do not install or regenerate it just for exploration.
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

## 5. Active handoff — Phase 2

**Status** Code Complete — Deployment Pending.

**Verified** Isolated replica-set tests covered effective partial uniqueness, competing provisioning for distinct emails, factor enrollment and recovery, MFA throttling, replay and logout races, session revocation, and auditable writes. A fixture application role verified the collection-scoped `listIndexes` grant. Route tests covered admin account protection and ordinary registration, verification, login, logout, recovery, and account operations.

**Tests** `npm.cmd run test:admin-security` 8/8, `test:auth-login` 1/1, `test:auth-email` 5/5, `test:auth-ui` 4/4. `typecheck`, `lint`, and `build` passed. Lint and build reported the three documented baseline lint warnings. Build used an unreachable loopback MongoDB URI and fixture configuration.

**Files changed** `scripts/admin-factor.test.ts`, `scripts/admin-operator.test.ts`, `scripts/admin-session.test.ts`, `docs/ADMIN_CODEX_WORKFLOW.md`, `docs/ADMIN_DASHBOARD_IMPLEMENTATION.md`.

**Deployment gates** Approve read-only operator access to the named target for topology and index verification. Verify collection-scoped `listIndexes` using the deployed application's credential and check the deployed HTTPS origin and MFA keyring configuration. Separately approve any index preparation and private provisioning and enrollment. Rehearse recovery on an isolated deployment before activation. Keep admin dashboard routes closed until these checks pass.

**Next task** Have an authorized operator run the read-only `verify` procedure in `docs/ADMIN_OPERATOR.md` on the independently confirmed target and record the application credential's index access.

## 6. Update this compact handoff at the end of each task

Replace the **Active handoff** section above with a concise factual update (aim for **under 20 lines**):

- **Status:** Done / Partial / Blocked
- **Verified now:** Requirements and tests actually completed
- **Files changed:** Paths only
- **Remaining:** Prioritized next 1–3 gaps
- **Blockers / deployment gates:** Facts, not guesses
- **Next task:** One specific bounded action

Avoid long transcripts, pasted diffs, repeated architecture explanations, and full test logs. Keep `docs/ADMIN_DASHBOARD_IMPLEMENTATION.md` as the detailed long-term roadmap; update its phase status only when evidence supports it.
