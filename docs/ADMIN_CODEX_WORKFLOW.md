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

**Status** Phase 9 implemented. Production delivery activation is pending.

**Verified now** Revision-aware drafts and scheduling, content-bound audience confirmation, transactional publication and receipt-backed delivery, safe erasure, and retries from committed checkpoints.

**Files changed** `app/(admin)/admin/{announcements/page.tsx,loading.tsx}`, `app/api/{admin/announcements,account,internal/notifications/reminder-schedule}/route.ts`, `components/admin/{admin-page,admin-announcements,announcement-editor}.tsx`, `lib/{admin/{announcement-contract,announcements,security,security-contract},auth/admin-session-state,mongodb-transaction,notifications/{announcement-worker,announcements,service}}.ts`, `models/{Announcement,Notification,User,AdminAuditLog}.ts`, `scripts/{admin-announcements.test.ts,admin-ui.browser.mjs,notification-events.test.ts}`, `package.json`, `docs/{ADMIN_CODEX_WORKFLOW,ADMIN_DASHBOARD_IMPLEMENTATION}.md`.

**Tests** Focused delivery and notification, reminder, administrator security, security logs, TypeScript, lint and loopback-only production build passed. Three existing lint warnings remain.

**Browser QA** Full admin suite passed with the production feature-gate check. Announcement editor, dialog and delivery detail fit all eight widths. Drafts, estimates, scheduling, cancellation, confirmation focus, failed delivery and retry, search, and unavailable storage were exercised.

**Deployment gates** Verify approved queue, listing, receipt and inbox indexes, test the existing private 15-minute dispatch in staging, and enable `ABII_ANNOUNCEMENTS_DELIVERY_ENABLED` only after approval. No production resources changed.

**Next task** Provision and validate the documented Phase 9 storage and scheduler prerequisites on approved staging infrastructure.

## 6. Update this compact handoff at the end of each task

Replace the **Active handoff** section above with a concise factual update (aim for **under 20 lines**):

- **Status:** Done / Partial / Blocked
- **Verified now:** Requirements and tests actually completed
- **Files changed:** Paths only
- **Remaining:** Prioritized next 1–3 gaps
- **Blockers / deployment gates:** Facts, not guesses
- **Next task:** One specific bounded action

Avoid long transcripts, pasted diffs, repeated architecture explanations, and full test logs. Keep `docs/ADMIN_DASHBOARD_IMPLEMENTATION.md` as the detailed long-term roadmap; update its phase status only when evidence supports it.
