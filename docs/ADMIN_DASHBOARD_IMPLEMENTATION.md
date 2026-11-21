# Abii Admin Dashboard implementation handoff

## 1. Project overview

Phase 1 inspected main at dd8f23e. The working tree already contained a modified skills-lock.json and eight untracked hero files. This specification covers one privately provisioned administrator and eight pages. Only the audit is implemented. Preserve the public site, authenticated learning experience, dependencies and stored data. The stack is Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Mongoose 8 and MongoDB.

## 2. Current architecture

App Router pages resolve data on the server. app/api owns HTTP input, identity and responses. Domain work lives under lib, schemas under models, client interaction under components. lib/mongodb.ts caches the connection and retries failed acquisition. The connection helper does not verify index deployment.

**Identity path.** app/api/auth/register/route.ts takes only name, normalized email and password through lib/auth/validation.ts, hashes with bcrypt cost 12 and creates an unverified User. Registration and successful password checks for unverified accounts start a pending identity ticket and email challenge. Login rejects incorrect credentials. Verification updates emailVerifiedAt, clears challenges and calls createSession. Verified login also calls createSession and returns /dashboard. Session issuance reads emailVerifiedAt and sessionVersion. lib/auth/session.ts signs HS256 subject=user ID and sv with issuer abii, audience abii-web and 30-day expiry. lib/auth/constants.ts sets abii_session HttpOnly, SameSite Strict, path / and Secure in production.

Middleware verifies JWT authenticity and expiry for its listed learning routes. The authenticated layout calls getCurrentUser, which verifies the JWT, reads the subject, verifies claims again and fetches _id, name, email, createdAt, profileImage, settings.studyTimezone, emailVerifiedAt and sessionVersion. It requires a valid verification date and matching version (legacy missing version means zero). The signed-ID-only helper cannot establish current privileges. The layout redirects signed but unverified accounts to verification. API handlers check identity independently and scope learning queries by owner. Logout clears session and flow cookies locally. Password change and reset increment the database version, invalidating prior sessions.

**Write surfaces.** Account profile edits name, profile-picture edits image and provider ID, password verifies the old password, account DELETE accepts typed confirmation and cascades in a transaction. Settings, featured badges and notification preferences write selected User settings. Registration creates accounts, verify-email stamps verification, forgot-password verify issues a grant and reset consumes it to replace the password. Data/history and data/materials erase activity. Data/export projects owner-scoped account/settings, materials, reviews, completed sessions and notifications. Keep secrets out of settings and export projections. Public registration explicitly selects fields. No admin role, suspension state or confirmed public role escalation exists in the inspected flow.

**Data map.** Each name below refers to models/<name>.ts. Owner means userId referencing User. Catalog describes schema declarations, not live index verification. Ordinary material rows have creation/update timestamps. Deletion routes explicitly clean related data; Mongo references do not cascade automatically.

|Model|Ownership, time and useful data|Index/access pattern and retention consequence|
|---|---|---|
|User|Identity, email/verification date, password hash, version, settings, createdAt|Unique email, verified-date/_id cursor. Account deletion removes denominator history.|
|SubjectFolder / Subject|Owner's ordered subject groups / subject with optional subjectFolderId|Folder unique owner/name and owner/position. Subject owner index. Current inventory only.|
|Folder / Topic|Owner + subject. Topics may have folderId. Name, normalized name, position|Both unique owner/subject/normalized name and ordered by owner/subject/position. Topic also ordered within folder. Material/account cleanup.|
|Flashcard|Owner + subject + topic, standard or items, question/answer, scheduling or mastery inputs|Owner/subject and owner/subject/topic. Deleted cards disappear from inventory. Avoid returning content for platform counts.|
|ReviewRecord|Owner + flashcard, result, questionType, reviewedAt, nextReviewAt, optional session/question index|Owner/card/due and latest, owner/reviewed time, owner/mode/card/recent, partial unique owner/session/question, pending-achievement index. Card changes/deletion, history, materials and account erasure remove evidence.|
|QuizSession|Owner, scope, subject/topic, type, questions, state, completedAt, lastActivityAt, expiresAt|Owner/created and two active-owner activity/expiry indexes. TTL expiresAt + 0. lib/quiz/service.ts sets completed expiry to 24 hours. Filter by expiry explicitly.|
|AchievementEvent|Owner, kind, occurredAt, optional sessionId, subjectId, compact score facts|Unique owner/idempotencyKey, owner/kind/dayKey or occurredAt, owner/createdAt. Survives session expiry. History/material erase calls clearAchievementActivity; account deletion removes events.|
|UserBadge / BadgeReconciliation|Owner, unlock time, badge ID / one baseline of verified minimum evidence per owner|Unique owner/badge and owner/unlockedAt; unique reconciliation owner. History erasure retains awards, removes minimal evidence and reconciliation. Awards cannot reconstruct timelines.|
|Notification|Owner, type, target, metadata, createdAt, readAt, optional expiresAt|Owner/created/_id, owner/readAt, unique owner/dedupeKey. Account deletion removes inbox. Receipt/read state measures delivery imperfectly.|
|NotificationScheduleState|Global job key, cursor, lease token/until, updatedAt|_id identifies mutable scheduler state. No run history.|
|SupportSubmission|Public request HMAC key, status, expiresAt|Unique key and TTL. Processing window 10 minutes, accepted 24 hours. No correspondence.|
|AuthChallenge / PasswordResetGrant / AuthRateLimit|Owner/purpose challenge, owner/token grant, keyed rate window|Unique owner/purpose, tokenHash, key/window respectively; expiry indexes. Challenge cleanup delayed one hour beyond expiry. Short-lived credentials/counters cannot supply a security timeline.|

## 3. Skills and development strategy

skills-lock.json lists graphify, backend-architecture and ponytail. All three instructions were readable in .agents/skills. Graphify documents graphify query, path and explain for existing graphs and incremental --update. graphify-out/graph.json was absent and the executable unavailable on PATH. Used targeted imports, schema declarations, mutation searches and direct reads instead. No package installation, semantic indexing or environment-file ingestion. Apply backend-architecture to guard/service boundaries in Phase 2 and later data work. Apply ponytail throughout: reuse the owner of each operation, add persistence only for a named requirement. Revisit Graphify when a local runtime exists.

## 4. Administrator security architecture

1. Extend User with scalar enum role (user/admin, default user), suspendedAt (nullable), and protected MFA state outside settings. Read legacy missing roles as user. A missing, null or malformed role must never pass admin authorization.
2. Deploy a named unique ascending index on role with partialFilterExpression {role:"admin"}. Multiple ordinary/legacy users stay outside it. This enforces **at most one**. Private bootstrap establishes one; lifecycle rules preserve it. Inspect existing BSON role types/values, email collisions, duplicates, collection topology and effective indexes first. Verify compatibility on deployment-equivalent MongoDB (especially shard-key restrictions). Abort on mismatch. Explicit additive createIndex, await completion and inspect listIndexes for key, uniqueness, filter and effective collation before allowing bootstrap. Never use syncIndexes to drop unrelated indexes.
3. Use a private operator-only CLI with explicit environment/database confirmation and narrowly scoped credentials. Verify mailbox ownership out of band. Insert a fresh identity with normalized reserved email and strong secret via protected input. Never promote by matching public email, overwrite credentials on retry or log secrets. Unique email and role protect concurrent inserts. Treat duplicate key as conflict, inspect status without changing the winner. Require private factor enrollment before privileged access. Disable bootstrap credentials afterward.
4. Reuse verified-password login. For admin issue only a short-lived, single-use MFA challenge bound to account, purpose, version and browser. Verify possession (e.g. TOTP with encrypted seed and atomic last-used-step check), then rotate into a shorter admin session with signed assurance, auth time and distinct audience or purpose. Reject learning cookies, email verification and pending tickets for admin access. Re-read current role, suspension, verification and version for each protected request. Require fresh step-up for sensitive changes. Set an explicit short expiry (proposed 30 minutes). Revoke admin logout server-side by version bump; document single-admin all-device sign-out.
5. Never suspend, demote or delete the sole admin via ordinary APIs or Users actions. Apply predicates inside the mutation/transaction before cascades. Suspend ordinary accounts atomically with version increment; unsuspension cannot revive old cookies. Block session issuance and resolution for suspended users. Disable public password reset issuance AND consumption for admin, including pre-existing grants. Guard password change, factor rotation and other security-sensitive account actions from generic routes. Recovery requires independently held one-time high-entropy codes, display once, store hashes, consume atomically, revoke sessions and challenges, rotate codes after use. Store offline recovery material; rehearse operator recovery of the same account under restricted audited access before launch. No email-only bypass.
6. lib/auth/redirect.ts rejects off-origin, protocol-relative, backslash and login/register loops but accepts internal /admin. components/auth/auth-form.tsx prefers next over server redirect. After MFA permit only canonical paths in the eight-route allowlist. Default to /admin. Normal callers targeting admin receive a safe user destination or 403. Test encoded separators, normalization, auth loops and query handling.
7. Middleware is a coarse redirect/cache layer. Require a server-only admin guard on every page/data loader, handler and server action. Layout-only checks miss direct API calls. Return 401 for absent/expired/revoked identity, 403 for authenticated insufficient privilege, generic failures on DB outages. Emit private, no-store on every admin response including errors. Keep sensitive DTOs server-only until explicitly projected. Check trusted configured Origin on browser mutations and reject missing/cross-site origins. Existing validOrigin permits missing Origin. Reuse rateAllowed and properly configured trusted-ingress IP checks (currently optional); throttle password, MFA, recovery and bootstrap attempts with account/global limits, bounded cooldown and operator recovery.
8. Commit privileged writes and redacted audit evidence together using lib/mongodb-transaction.ts. Fail closed if required audit persistence fails. Record denied attempts separately with bounded volume. Never log credentials, OTP, recovery codes, hashes, student content or raw request bodies. These controls are future requirements. Today's cookie-only logout, email-based recovery and typed-confirmation account deletion are unsuitable for privileged accounts.

## 5. Eight-page information architecture

All pages require the guard above. Reads can be server functions; operations below describe contracts without requiring a parallel REST layer. Every page uses the shared hero, cards and labelled skeleton region, with distinct no-results, forbidden, unavailable/retry and stale/partial states. Never render an unavailable measurement as zero.

|Page / phase|Sections, data and operations|Interaction, controls and specific states|
|---|---|---|
|/admin · Overview · 4|Current account/card counts, retained learning activity, completion evidence, timestamped health summary. Read bounded snapshots.|Window picker and drill-down links. Show partial cards when probes are missing.|
|/admin/users · Users · 5|Projected User directory, verification, join date, suspension, detail. Cursor list/search, read, suspend/restore.|Confirm with modal, audit reason, invalidate sessions. Exclude admin as target. Empty search and conflict feedback.|
|/admin/analytics · Analytics · 6|Review volume, distinct learning users, trends, cohorts and mode coverage. Aggregate by period.|Choose window and metric. Show denominator, timezone, incomplete-history notice and immature cohorts.|
|/admin/performance · Performance · 7|Volume, latency distribution, errors, probes, reminder runs. Read bucketed telemetry and freshness.|Filter service/route template. No arbitrary queries or credentials. Distinguish stale samples from outage.|
|/admin/security · Security · 8|Paginated redacted auth events, audit trail, rate-limit alerts. Read by time/type/outcome.|Inspect detail and recent failures. Immutable records, no log-edit action. Empty filtered timeline.|
|/admin/announcements · Announcements · 9|Draft, preview eligible count, schedule/cancel, publish, inspect delivery and retry failures.|Validate target and text. Confirm publication, freeze published content and dedupe key. Show queued, partial and terminal states.|
|/admin/support · Support · 10|Search/filter tickets, view thread, set status, append reply/internal note. Persist inbound before delivery.|Separate internal notes from outbound messages. Escaped content, restricted PII, explicit retry and pending delivery.|
|/admin/settings · Settings · 11|Admin preferences, allowlisted platform values, factor/recovery management. Read projected values, validate patch and rotate factors.|Version-check concurrent edits, confirm sensitive actions with MFA, audit. Show defaults, saved, validation and conflict states.|

## 6. Analytics data contract

Store UTC instants. Default to the last 7, 30 or 90 **complete UTC calendar days**, half-open [start,end). Label displayed timezone and translate timestamps for display only. Inventory is live at the indicated read time. All account metrics exclude the admin, include legacy ordinary users and count suspended accounts unless labeled otherwise. No demo exclusion without a verified identifier. Deleted owners and erased evidence cannot be reconstructed. A zero denominator yields no data.

|Display / readiness|Definition and source|Limit or instrumentation|
|---|---|---|
|Total Users / Available|Count current ordinary User documents, including unverified, as of read.|Snapshot, not historical population.|
|New Users / Conditional|Count surviving ordinary User.createdAt in window, group UTC day.|Deleted signups absent.|
|Active Users; DAU/WAU/MAU (learning) / Conditional|Distinct ReviewRecord.userId with reviewedAt within window. DAU one UTC day, WAU trailing 7 complete days, MAU trailing 30. Overview uses selected reporting window.|Counts reviewers only. Deduplicate across days for window totals. Erasure reduces totals.|
|Authenticated active users / Requires Instrumentation|Distinct ordinary users completing at least one authenticated interactive application request in period; exclude polling, jobs, static assets and admin.|Introduce explicit minimal user/day activity coverage if product needs this metric. Login, session presence and updatedAt are insufficient.|
|Total Flashcards / Available|Count surviving owned Flashcard documents at read time. Enumeration counts as one card.|Current inventory; no lifetime implication.|
|Completed Quizzes / Conditional|Count unique owner/session identities of quiz-completed events in occurredAt window. Exclude resumed-quiz-completed duplicates. For reconciliation union surviving completed sessions by same identity and completedAt.|Verified minimum. Older completions may lack events. Session TTL 24h. Badge reconciliation contains lower bounds, not a complete dated ledger. No lifetime total guaranteed.|
|Completed Review Activity / Conditional|Count stored ReviewRecord rows by reviewedAt, grouped by UTC day, any result.|Recorded review observations, not completed sessions or every UI interaction. Erasable.|
|Quiz Mode Distribution / Conditional|For surviving completed, unexpired QuizSession rows, group by selected type, divide by qualifying completions at completedAt.|Only short-lived sample. For 7/30/90 days add selected mode to idempotent completion event going forward. Review questionType describes individual questions.|
|Subject and Flashcard Creation Trends / Conditional|Count distinct retained subject-created or flashcard-created event keys by kind/occurredAt/day. Alternatively label current rows grouped by createdAt as surviving creations.|Different populations. Check event coverage start, erasure and backfills.|
|Learning retention / Conditional|Cohort = surviving ordinary accounts created on UTC date D. Day-N return = cohort members recording ≥1 review on D+N divided by cohort size (N=1,7,30). Include only fully elapsed return days.|Learning return among surviving signups, biased by deletion. App-wide return requires authenticated activity instrumentation.|
|Account Verification Rate / Conditional|For surviving signup cohort in window, count with valid emailVerifiedAt before cutoff / cohort size. Report cutoff.|Measures verification only. Later cohorts have less time to verify.|
|System Health / Requires Instrumentation|At read time latest successful app + DB probes and scheduler freshness. Healthy only when all required checks pass and are fresh; unknown on missing evidence.|Define probe cadence/timeout and show component timestamps before use.|
|Request Volume / Requires Instrumentation|Count completed API requests by UTC completion time, bounded route template and method. Include failures; separate internal jobs.|Current selective logs lack coverage.|
|API latency, p50/p95/p99 / Requires Instrumentation|Elapsed server time from entry to response including failures; mean=sum/count, percentiles from merged duration histogram per window.|Show milliseconds, bucket precision and sample count. Never average percentiles.|
|Error Rate / Requires Instrumentation|Thrown failures or 5xx responses counted once / completed requests on same routes and window.|Track 4xx separately. Missing telemetry means unknown.|
|Database Operation Latency / Requires Instrumentation|Duration sum/count and quantiles for observed database calls by allowlisted operation and completion time.|Connection acquisition separate. Report sample coverage.|
|Service Availability / Unavailable historically|Successful scheduled external probes / expected probes per service/window; flag missing probes separately.|No verified independent probe history. Phase 7 needs an independent observation point.|
|Background Job Status / Requires Instrumentation|Last started/finished/outcome by scheduled slot; overdue if no completion by slot plus configured grace. Aggregate successful slots / expected slots.|Lease and cursor show current state only.|

Filter time first, project IDs/compact facts, aggregate and paginate on MongoDB. Most current indexes lead with owner; validate candidate reviewedAt/userId, kind/occurredAt/userId, createdAt/_id indexes with explain on representative staging loads before deployment. Cap ranges at 90 days and bound runtime. Avoid unbounded distinct arrays, per-user history loaders and summing daily uniques. Add deletion-aware daily rollups only after measuring query cost and specifying erasure/recomputation and coverage dates.

## 7. Database extension plan

Proposed retention values below require owner approval before collection. Scope administrative reads to authorized server code. Use bounded indexes and projections.

|Phase / store|Reason and minimum fields|Indexes, access and retention|
|---|---|---|
|2 · AdminAuditLog|Account mutations need attributable durable evidence. actorId, action, target identifier, time, outcome, safe reason, request ID.|Time/_id and target/time; append-only service, privileged read; proposed one year, controlled expiry and isolated backups.|
|2 · SecurityEvent|Failed auth and denied access may have no actor or committed mutation. Type, time, outcome, pseudonymous subject, correlation ID.|Type/time, TTL e.g. 90 days. Restricted writer, redact identifiers. UI in Phase 8.|
|6 · AchievementEvent extension|Persist selected mode on future quiz-completed events. Reuse existing owner/session idempotency and erasure. Optional user/day activity only if true app-wide DAU required.|Unique owner/day for optional activity, delete with user, retention ≥ longest cohort plus return horizon. Avoid recording browsing URLs.|
|7 · PerformanceMetric|Only if provider cannot supply equivalent queryable buckets. Time bucket, template, count/errors, duration sum/histogram, sample count. Job slot, outcome and freshness for reminders.|Unique series/bucket, TTL e.g. 120 days. Service writes, admin reads. Batch asynchronously; use platform counters for volume, sample costly DB spans. Never await a Mongo write per quiz answer.|
|9 · Announcement|Existing notification rows describe recipients only. Immutable publication key, title/message/validated target, status, scheduledAt, creator, version, lease, attempt summary.|Unique key, status/scheduledAt. Admin edits drafts; leased scheduler claims due work atomically. Retain publication metadata for audit period.|
|10 · SupportTicket + SupportMessage|SupportSubmission is only a delivery reservation. Ticket stores requester address/name, category, subject/summary, status, timestamps, unique intake key. Messages store ticketId, actor/direction, body, internal flag, delivery state and idempotency key.|Ticket status/updatedAt and normalized email; message ticketId/time and unique delivery key. Restrict notes to admin, no unbounded embedded thread. Proposed purge 180 days after closure, including bodies/backups per policy.|
|11 · Settings|Use protected User preference fields for admin-local choices. Introduce a singleton document only for actually shared settings, with typed fields, version and updatedAt.|Fixed _id, audited compare-and-set writes, retain current values. Never store provider secrets here.|

**Integrations.** lib/notifications/announcements.ts validates content, filters verified users opted in or without a stored whats_new preference, counts in dry-run and scans ascending _id in batches (100 default, 500 max, eight concurrent writes). createNotification uses per-owner dedupe. scripts/publish-notification-announcement.ts supports operator publication. Reruns re-evaluate recipients; totals per attempt are not cumulative unique deliveries. Freeze audience cutoff/policy, account for preference changes and persist progress before offering scheduled retries.

app/api/support/contact/route.ts bounds JSON, validates origin, honeypot and fields, rate-limits, reserves an HMAC key, renders lib/email/support-template.ts and calls lib/email/brevo.ts. Name, address, category and message go to delivery. Existing documents cannot populate a historic inbox. Future replies need an idempotent delivery worker and reconciliation of ambiguous provider outcomes. Never send internal notes.

lib/performance/server-timing.ts uses AsyncLocalStorage, optional ABII_PERF_TRACE and console logs. Quiz start/answer/finish have wrappers; DB operation counts are explicitly annotated. No complete status-code stream or history store. vercel.json schedules notification-reminders every 15 minutes UTC; configuration does not prove successful runs. Preserve private scheduler authentication and isolate telemetry failure from request processing.

## 8. UI reuse and asset inventory

Prefer an isolated admin layout and navigation configuration. components/app-shell.tsx couples learning links, notifications, profile and six-slot mobile navigation. Share visual primitives and extract shell framing only where identical. Preserve the 1600px max-width frame, 220px desktop rail at lg, 76px header, profile/avatar controls, scrollable content and safe-area mobile navigation. Use a compact mobile menu for eight destinations. At sm the white frame gains border, rounding and padding; default breakpoints sm 640, lg 1024. app/fonts.ts supplies Onest and local Cute Dino. app/globals.css provides semantic border, text, pink, success and error tokens.

Reuse components/ui/abii-page-hero.tsx with heading, description, actions, responsive next/image and right-bottom mascot. Dashboard uses 248–254px desktop/tablet height and 48–49% mascot width. Reuse Card's rounded white surface, soft shadow and border, rounded Button, Modal confirmation/busy state, toast feedback and SkeletonRegion. Follow components/motion page-entry, page-transition, scroll-reveal and scroll-root-context; preserve reduced-motion branches and CSS preferences. Check keyboard navigation, focus, mobile overlap and reduced motion against the existing dashboard in Phase 3.

All paths below are relative to **public/dashboard-hero/admin/**. public/admin/hero/ is absent. All eight decoded via sharp, with actual transparent pixels. Retain the existing admin-<page>.png convention and untracked originals.

|File|Pixels|Bytes|
|---|---:|---:|
|admin-overview.png|1254 × 1229|1317293|
|admin-users.png|1254 × 1254|1348658|
|admin-analytics.png|1254 × 1254|1265375|
|admin-performance.png|1254 × 1254|1311502|
|admin-security.png|1254 × 1217|1201118|
|admin-announcements.png|1254 × 1254|1206240|
|admin-support.png|1254 × 1254|1178573|
|admin-settings.png|1254 × 1254|1222397|

Decoded previews show consistent pink soft-3D otters, rounded heads/ears, dark oval eyes, black noses, pale muzzles/chests, blush and smiles. Near-square compositions include much of the torso; some extend to upper legs. Phase 3 should check framing at rendered hero width. Subtle eye reflections appear present. Exact zero-highlight compliance and three individually discernible digits on every paw are unverified, especially on bent/overlapping paws. Obtain art sign-off before declaring compliance. At roughly 1.2–1.35 MB each, serve responsive optimized sizes and load only the current hero.

## 9. Change-impact map

|Phase / change surface|Direct dependencies and regression check|
|---|---|
|2 · models/User.ts, lib/auth/session.ts, constants.ts, http.ts, redirect.ts, middleware.ts|User projection feeds layout, APIs, login and settings. Keep legacy verified sv=0 working; test database revocation, cookie audience, outages and old ordinary records.|
|2 · app/api/auth/{register,login,logout,verify-email,forgot-password/{verify,reset,resend}}/route.ts and forgot-password/route.ts; components/auth/auth-form.tsx|Validators, tickets, bcrypt, challenges, email and session issuance. Prove no pending or reset ticket authenticates admin. Preserve ordinary email flow.|
|2 · app/api/account/{profile,profile-picture,password}/route.ts, account/route.ts, settings/route.ts, data/export/route.ts under app/api|Allowlist edits and projections, guard against self-deletion before any cleanup. Regression-test ordinary account edits, exports and erasure.|
|2 · proposed lib/auth/admin.ts, admin MFA module, private provisioning and index-verification scripts, audit/security schemas|Server-only, cached DB connector, transaction helper, controlled environment secrets. Verify staging topology, least privilege and rollback.|
|3–5 · proposed app/admin layout/pages, admin shell and guarded user management|Reuse hero, controls, motion and account state. Test personal dashboard nav separately from admin links, mobile focus and stale sessions.|
|6–8 · proposed server-only analytics/monitoring readers; extend completion event, trace wrappers and reminder outcome recording|Benchmark indexes and quiz latency, verify idempotence, missing samples and erasure. Leave grading/mastery, session TTL and badge awards intact.|
|9–11 · notification publisher, support intake, allowlisted settings|Reuse notification contracts, dedupe and email templates. Exercise retry after partial delivery, private note isolation and settings conflicts.|
|12 · tests and build tooling|Keep existing package scripts, dependencies, landing pages, user-owned APIs and assets as baseline. Run isolated regression, accessibility, security and restore tests before rollout.|

## 10. Validation baseline

|Command|Observed baseline|Relevance|
|---|---|---|
|npm.cmd run typecheck|Pass, exit 0.|TypeScript baseline.|
|npm.cmd run lint|Pass, exit 0, three warnings. Existing img in components/app-shell.tsx:206 and unused disable directives in lib/mongodb.ts:11 and lib/quiz/normalize.ts:12.|Keep shell warning visible during reuse.|
|npm.cmd run test:auth-login|Pass, 1/1 on isolated temporary replica set with email delivery disabled.|Verified and unverified account login regression baseline.|
|npm run test|Skipped. Composite includes test:demo, whose apply test executes seed logic. The audit excludes seeders. Other suites are not certified by the targeted pass.|Run the full suite separately when fixture seeding is authorized.|
|npm.cmd run build|Pass, exit 0. Next 15.5.29 compiled with jose Edge warnings for CompressionStream/DecompressionStream and the same lint warnings. Telemetry disabled; MongoDB URI overridden to an unreachable loopback endpoint.|Verify middleware on deployment-equivalent Edge runtime in Phase 2. Build success does not exercise production DB or delivery.|

Warnings predate the documentation change. No production job, email, database migration or publication was invoked.

## 11. Implementation roadmap

|Phase|Outcome|Status|
|---|---|---|
|1|Codebase audit and technical foundation|Complete|
|2|Single-admin authentication and security|Code Complete — Deployment Pending|
|3|Guarded layout, navigation and hero integration|Not Started|
|4|Overview|Not Started|
|5|Users|Not Started|
|6|Analytics and event coverage|Not Started|
|7|Performance and job monitoring|Not Started|
|8|Security timeline and alerts|Not Started|
|9|Announcements|Not Started|
|10|Support|Not Started|
|11|Settings|Not Started|
|12|Integrated verification and controlled release|Not Started|

## 12. Phase 2 handoff

Start with the Phase 2 rows in section 9. Keep public admin routes disabled during deployment. First deploy legacy-compatible readers and protected writes; preflight the target database, back up identity data, build and verify the partial index, then provision privately and enroll/rehearse recovery. Check exactly one valid administrator and a working second factor before enabling privileged access. Disable route exposure first on rollback; preserve the constraint, revoke admin sessions and retain audit evidence. Never roll back to ordinary account deletion/reset behavior while a privileged account remains reachable.

**Release gate before Phase 3.** On an isolated replica set, verify two simultaneous bootstrap attempts produce exactly one admin; duplicate email, wrong database, missing/wrong index and pre-existing public account fail safely. Exercise direct API/page access, ordinary/legacy sessions, expired or forged tokens, wrong audience, missing MFA, verification flow, suspended accounts and immediate version revocation. Attempt role/credential updates through every public write surface, including nested settings. Test self-delete/suspend, grants created before provisioning, origin absent/mismatched, rate limits, replayed challenges and concurrent recovery-code redemption. Verify no secrets in exports, DTOs, logs or cacheable responses; prove atomic audit writes and safe handling of DB failure. Check ordinary redirect, password recovery, profile, settings and account deletion still work. Confirm ingress IP trust, key custody, clock synchronization, operator recovery and actual live index evidence in an authorized deployment window. These are implementation gates; Phase 1 did not inspect production or provision identity.

