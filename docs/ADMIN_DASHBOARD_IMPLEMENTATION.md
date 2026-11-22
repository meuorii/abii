# Abii Admin Dashboard implementation handoff

## 1. Project overview

Phase 1 inspected main at dd8f23e. The working tree already contained a modified skills-lock.json and eight untracked hero files. This specification covers one privately provisioned administrator and eight pages. The audit, isolated administrator authentication, and guarded eight-page shell are implemented. Preserve the public site, authenticated learning experience, dependencies and stored data. The stack is Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Mongoose 8 and MongoDB.

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

Phase 2 used `graphify` for dependency review, `api-security` for the auth and authorization review, and `mongodb-mongoose` with `ponytail` for the singleton and operator workflow. The installed Graphify skill directs narrow searches to targeted imports and `rg` when the graph is absent. This checkout had neither a graph index nor a Graphify command on PATH.

## 4. Administrator security architecture

| Entry point | Authority and protections |
|---|---|
| Shared `/login` | The login handler checks whether `admins` reserves the normalized email. Ordinary login reads eligible `users` records and keeps the existing email verification flow. Admin password checks use the dedicated hash. Legacy or ambiguous admin identities receive the generic login failure. |
| Admin MFA | `admin-factor.ts` stores a five-minute password-bound challenge digest in `admins.primary`. Google Authenticator TOTP uses six digits, SHA-1 and 30-second steps. The encrypted seed is bound to the namespaced identity. A transaction consumes the challenge, advances the last-used TOTP step and commits the login audit before the session is issued. |
| Admin session | The admin cookie uses an HS256 JWT with its own audience and type, the `admin:primary` subject, MFA claim, 30-minute expiry, and current session version. Each privileged request loads the authoritative active singleton and verifies the factor and version. Logout revokes the version for all administrator devices. MFA and successful identity switching clear the other authentication flow's cookies. |
| Admin pages and operations | The server-side layout protects all eight shell pages and preserves `ABII_ADMIN_UI_ENABLED`. Overview also checks the request-scoped guard before starting privileged reads. Attach new privileged data reads and handlers to `requireAdmin`. Sensitive mutations use `withFreshAdminMutation` to check recent MFA and serialize with revocation. Authentication responses and admin pages use no-store. |
| Public writes and recovery | Registration allows ordinary fields and reserves any administrator email. Ordinary verification, recovery, settings, deletion, export, and learner data use `users` and ordinary JWTs. Administrator recovery uses the private CLI with one offline code, clears the old code set, revokes sessions, and requires new TOTP enrollment. |
| Evidence | Existing `adminauditlogs` and `adminsecurityevents` record committed security changes and bounded denials. New administrator events use `admin:primary` as actor. Historical events retain their original IDs and representation. Audited privileged writes roll back if audit persistence fails. |

Setup always inserts the fixed string `primary` into `admins`. MongoDB's built-in unique `_id` index rejects a concurrent second claim, while runtime reads reject extra documents, malformed state, legacy admin rows or a colliding email. Direct database writes remain subject to scoped access and change control. [MongoDB unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/)

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
|2 · admins|Single administrator credentials, encrypted MFA, recovery-code digests and session state.|Built-in unique `_id` index and fixed `primary` identity. No additional administrator index.|
|2 · AdminAuditLog|Account mutations need attributable durable evidence. actorId, action, target identifier, time, outcome, safe reason, request ID.|Time/_id and target/time; append-only service, privileged read; proposed one year, controlled expiry and isolated backups.|
|2 · SecurityEvent|Failed auth and denied access may have no actor or committed mutation. Type, time, outcome, pseudonymous subject, correlation ID.|Type/time, TTL e.g. 90 days. Restricted writer, redact identifiers. UI in Phase 8.|
|6 · AchievementEvent extension|Persist selected mode on future quiz-completed events. Reuse existing owner/session idempotency and erasure. Optional user/day activity only if true app-wide DAU required.|Unique owner/day for optional activity, delete with user, retention ≥ longest cohort plus return horizon. Avoid recording browsing URLs.|
|7 · Performance metrics and reminder runs|Bounded minute fragments by quiz handler and separate authenticated reminder attempt records.|Eight-day TTL, explicit operator provisioning and isolated post-response delivery. See Phase 7 rollout below.|
|9 · Announcement|Existing notification rows describe recipients only. Immutable publication key, title/message/validated target, status, scheduledAt, creator, version, lease, attempt summary.|Unique key, status/scheduledAt. Admin edits drafts; leased scheduler claims due work atomically. Retain publication metadata for audit period.|
|10 · SupportTicket + SupportMessage|SupportSubmission is only a delivery reservation. Ticket stores requester address/name, category, subject/summary, status, timestamps, unique intake key. Messages store ticketId, actor/direction, body, internal flag, delivery state and idempotency key.|Ticket status/updatedAt and normalized email; message ticketId/time and unique delivery key. Restrict notes to admin, no unbounded embedded thread. Proposed purge 180 days after closure, including bodies/backups per policy.|
|11 · Settings|Consider dedicated administrator preference fields for admin-local choices. Introduce a singleton document only for actually shared settings, with typed fields, version and updatedAt.|Fixed _id, audited compare-and-set writes, retain current values. Never store provider secrets here.|

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
|2 · models/Admin.ts, lib/auth/admin-identity.ts, admin MFA/session modules and private setup|Server-only singleton validation, existing DB connector, transactions, rate limits, audit and approved Atlas topology checks.|
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
|2|Single-admin authentication and security|Dedicated identity verified in isolation, production setup pending|
|3|Guarded layout, navigation and hero integration|Complete in isolated development|
|3.1|Learner dashboard visual parity across all eight admin pages|Verified with local fixtures|
|4|Overview|Implemented, isolated validation|
|5|Users|Complete in isolated validation, production rollout pending|
|6|Platform analytics and coverage reporting|Complete in isolated validation, production rollout pending|
|7|Performance and job monitoring|Implemented. Production activation and independent probes pending.|
|8|Security timeline and alerts|Implemented. Production index verification and activation pending.|
|9|Announcements|Not Started|
|10|Support|Not Started|
|11|Settings|Not Started|
|12|Integrated verification and controlled release|Not Started|

## 12. Phase 2 handoff

Follow [the operator guide](ADMIN_OPERATOR.md) for the single authorized `npm run admin:setup` workflow. Setup writes the pending and active states of one `admins.primary` document and records related audit events and rate counters in existing storage. A missing security collection or index requires a separate approved change. An existing legacy administrator must be resolved by the database owner before provisioning. Production remains pending and requires the approved Atlas inventory, scoped access, compatible deployment, mailbox verification, key custody and an independent restore.

The isolated replica-set tests exercise concurrent setup, wrong-target and missing-storage refusal, interrupted enrollment, TOTP replay and expiration, audited recovery, legacy and malformed records, revocation races, and ordinary-user isolation. The browser suite exercises the existing eight pages through the feature gate and through ordinary, pending, and completed authentication. Production availability, Atlas permissions, and production data are outside the isolated results.

## 13. Phase 3.1 visual parity handoff

- The local 1920px comparison measured a 96px admin left gutter and 32px top gutter before the change. The learner values were 24px and 20px. The admin inherits those gutters and the white canvas across all eight routes. The 1600px outer frame, 220px sidebar and 76px header remain the same.
- Both workspaces share the Abii brand mark, sidebar footer, navigation states, and account-control styles. Admin keeps its own navigation, drawer and sign-out flow. The Administration subtitle reserves the same space as the learner tagline, and the account control uses an initial from the administrator name.
- All eight original PNGs have visible artwork on their lowest row at a 50% alpha threshold. The admin hero uses a bottom-aligned, aspect-ratio-preserving image frame. Matching loading heights reserve the same space before content arrives.
- The browser suite exercises desktop geometry against the learner fixture, all eight mascot placements at 320, 375, 390, 768, 1024, 1280, 1440 and 1920px, reduced motion, the normal entrance sequence, keyboard dismissal, focus restoration and logout. All measurements use isolated fixtures.
- Typecheck, lint, the admin browser suite, and the loopback-isolated production build passed. Lint and build reported the three existing warnings. Screenshot review covered the learner and admin at 1920px, all eight admin pages at desktop width, and Overview at 375px and 768px.
- The requested learner palette is shared as-is. Its selected-navigation foreground measures 2.95:1 against the pink background, below the 4.5:1 target for normal-size text.

## 14. Phase 4 Overview handoff

- `/admin?period=7|30|90` uses complete UTC days with the current day excluded and a 30-day default. Total users and flashcards are exact current inventory queries. New users are retained ordinary accounts by creation date. Active learners are distinct retained ordinary accounts with recorded reviews. Review volume includes every matching record. Daily series include zero-count dates.
- Completed quizzes are a verified minimum. Canonical completion evidence is identified by event session ID or the writer's canonical event key. Unexpired completed sessions supply missing evidence. The aggregation deduplicates by owner and session, excludes companion resume events, and retains only ordinary accounts. Deleted or erased history and expired sessions without ledger evidence may reduce the count.
- Recent Users projects at most five rows, sorted by creation time and descending ID. Needs Attention can show the latest retained administrator denial in the selected window. A recovery denial prompts a review if unexpected. Neither the audit ledger nor delivery reservations establish an incident or ticket backlog. Platform health and support-ticket status remain unavailable.
- The page authorizes before issuing parallel, per-section reads. Results use a per-request timestamp and no persistent or shared response cache. Queries have a 1.5-second server budget and aggregates disable disk spilling. Above an estimated 50,000 documents, reviews require `{ reviewedAt: 1, userId: 1 }` and completion events require `{ kind: 1, occurredAt: 1, userId: 1 }`. A missing required index makes the relevant metric unavailable. Both candidate indexes were tested in isolation and are absent from automatic schema creation. The review range sample examined 2,508 documents without its candidate and seven keys with it. Expect additional storage and write maintenance for each approved index.
- Existing `_id` indexes support inventory and retained-owner checks, the session expiry index can support the reconciliation filter, and the security index leads with kind and event time. For a larger account inventory, stage an explain for `{ createdAt: -1, _id: -1 }` before proposing it for account dates and recent rows. Verify approved production plans and permissions separately before creating any index.

## 15. Phase 5 Users handoff

- `/admin/users` reads current ordinary accounts under the shared admin guard and feature gate. Four KPIs use one aggregation. Verification and suspension can overlap. The directory supports case-insensitive literal prefix search, composable filters and bidirectional pages of at most 20 rows. The sort value and ID are encrypted and authenticated against the query state. Counts and visible positions have bounded budgets. If a position or count is unavailable, the page reports the visible count.
- The account sheet loads on demand through `GET /api/admin/users/[id]`. The response exposes account identity, verification and suspension dates, and owner-scoped subject, topic, flashcard, review and quiz counts. The quiz count covers retained canonical completion events. Older quizzes may be missing. Each learning count uses a 1.5-second query budget and reports unavailable independently.
- `PATCH /api/admin/users/[id]` accepts an action, a trimmed 3–500 character reason, and an opaque revision bound to the account and current session version. It verifies the trusted origin, caps the body at 4 KiB, requires Google Authenticator sign-in within five minutes and permits 12 submissions per administrator per minute. The existing transaction increments the learner session version and commits both audit records. A stale or ambiguous outcome triggers a status read before the administrator can confirm again.
- Deployment requires the existing administrator feature gate, a trusted `APP_BASE_URL`, configured authentication secrets, audit and rate-limit storage, and MongoDB transactions. Above an estimated 50,000 user documents, browsing requires separately approved `admin_users_joined_id` with `{ createdAt: -1, _id: -1 }` and `admin_users_name_id` with `{ name: 1, _id: 1 }` and collation `{ locale: "en", strength: 2 }`. Both candidate indexes examined 21 keys for 21 rows on isolated fixtures of more than 50,000 accounts. They add storage and account-write maintenance. The schema does not create them.
- The unique email index supports normalized email equality and can support binary email prefixes. It does not make a case-insensitive name-or-email regex efficient. Prefix search is budgeted and disabled above 50,000 estimated documents. A larger deployment needs an approved indexed strategy for both normalized fields before enabling equivalent search at that scale. Check the actual collection size and explain plans before rollout.
- The isolated browser suite verified responsive layouts at 320, 375, 390, 768, 1024, 1280, 1440 and 1920px, keyboard and reduced-motion behavior, search and pagination, detail loading and retry, confirmation and interrupted-write recovery, both account transitions, and rejection of revoked learner sessions. The isolated replica-set suite verified concurrent transitions and rollback when the security audit insert fails. The requested regressions, typecheck, lint and loopback-isolated build passed with the three pre-existing lint warnings.

## 16. Phase 6 Platform Analytics handoff

- `/admin/analytics?period=7|30|90` uses adjacent equal UTC windows and a single read timestamp. The selected and prior windows exclude their respective end instants. Counts show relative change when the prior count is positive. Rates compare in percentage points when both denominators exist.
- Eligibility uses the ordinary-role filter and excludes users with an explicit nonempty `demoSeedKey`. All owner-based metrics include surviving eligible owners only. Phase 4 retains its original population, which includes marked demo accounts. Suspended ordinary accounts remain eligible for retained historical evidence.
- Registration uses surviving `User.createdAt`. Verification uses a fixed 24-hour clock from the registration timestamp. Both periods exclude accounts without 24 elapsed hours by their respective period ends. A valid verification must occur within that clock. Earlier verification timestamps and later verification do not count as 24-hour activation. First-study activation requires separate evidence.
- Reviews use retained `ReviewRecord` documents. Active learners are deduplicated separately per day and per reporting period. Accuracy divides correct attempts by attempts with a known correct or incorrect result. Unknown outcomes contribute to volume. For D1, D7 and D30 retention, each surviving signup counts once on its exact UTC return day. That day must end by the matching period boundary. The report groups consecutive seven-day signup dates and pools eligible counts for overall rates. D30 has no mature cohorts in 7- or 30-day reports under this rule. Deleted accounts and erased or unrecorded reviews leave gaps in historical evidence.
- Quiz mode shares use selected `QuizSession.type` from surviving completed sessions with `expiresAt` later than the report instant. Unknown modes are disclosed separately. The 24-hour TTL limits the sample and precludes an equivalent-period comparison. A future approved change could add an optional allowlisted `selectedMode` to newly written canonical `quiz-completed` events, retaining the existing owner/session key. Record the release timestamp as the earliest possible coverage date and measure the fraction of completions with a mode before offering historical comparisons. Existing events and quiz questions cannot reconstruct that field.
- Content creation counts surviving `Subject` and `Flashcard` documents by `createdAt`. Each enumeration card contributes one. Deleted materials cannot be reconstructed. Subject and flashcard streams have independent failure states and chart scales.
- The MongoDB aggregations match dates before grouping, disable disk spills and use a 1.5-second query budget. With more than 50,000 estimated documents in a collection, Analytics requires a date-leading index. Candidate patterns are `users: { createdAt: -1, _id: -1 }` (also proposed for Users), `reviewrecords: { reviewedAt: 1, userId: 1 }`, and `subjects` and `flashcards: { createdAt: 1, userId: 1 }`. Quiz sessions can use the existing `{ expiresAt: 1 }` TTL index. The isolated review range examined 2,515 documents before indexing and 14 after. The oversized subject fixture returned unavailable until its candidate was installed. Approve any new indexes separately after representative Atlas explains, including 90-day windows and storage and write costs.
- The isolated Chromium suite exercised 7/30/90-day navigation, keyboard and touch inspection, a daily data table, partial quiz coverage, independent query-failure states, and authorization. All eight requested widths passed through the actual admin shell under reduced motion. Desktop and mobile captures were reviewed. The analytics, security, Overview, Users and browser suites, typecheck, lint, and loopback-isolated production build passed. Lint and build retained the three existing warnings.

## Phase 7 monitoring and rollout

| Signal | Source and coverage |
|---|---|
| Quiz requests | Existing App Router trace context measures start, answer, finish, session load, resume and discard. Other public routes, admin traffic, upstream failures and reminder jobs are outside the request denominator. |
| MongoDB | Fixed set of driver-facing Mongoose calls within those handlers. Queries, writes and connection acquisition have separate distributions. App-observed timing includes driver work and failures. Transaction-wide timing, connectivity probes and provider infrastructure statistics have no source. |
| Reminders | Authenticated Vercel Schedules callbacks and authenticated private executions. Stored starts and terminal outcomes include a per-attempt ID, a hashed dispatch ID for Vercel, scheduled time, and aggregate result counters. Attempt duration comes from the stored start and finish. |
| Public availability | No configured independent probes or historical probe store was found. Availability remains unavailable. An approved external source must report successful probes and expected probe slots before availability can be calculated. |
| Hosting telemetry | Repository configuration uses ephemeral Vercel Node functions and a 15-minute UTC schedule. No log drain, provider telemetry credentials or queryable hosting feed is configured in repository evidence. Vercel deployment settings themselves were not inspected. |

### Measurements and delivery

- The 1-hour, 24-hour and 7-day windows use UTC, exclude the leading partial minute and include the open current minute. A fragment arriving during the read is omitted if its newest observation exceeds the report cutoff. The page prints the effective bounds, first included API bucket and newest observation. Closing gaps and empty intervals cannot be interpreted as zero traffic. Handler duration ends when the handler returns a response or throws. It excludes network time and stream delivery.
- Every eligible observation is admitted until the runtime reaches capacity. There is no intentional sampling. Server errors count thrown failures and 5xx once each, divided by all recorded requests. The rate describes recorded traffic. Selected database spans and incomplete delivery limit coverage.
- Immutable minute fragments contain one row per observed route, count, elapsed sum, 4xx, server error and thrown counters, last observation, and 26 histogram counters per distribution. Fixed bounds span 1–60,000 ms with overflow. Merging sums bucket counts. Nearest-rank p50, p95 and p99 use bucket upper bounds with minimum sample counts of 5, 20 and 100. A percentile landing in the open-ended bin is unavailable.
- Next.js `after()` uses the hosting lifecycle for response-independent work. Each instance admits at most two groups of 64 observations and collects for 125 ms per group. A group may split across a minute boundary. Each Mongo write uses a generated unique document ID and majority write concern. Driver retries reuse the same IDs. The collector does not replay writes at the application layer. Concurrent instances add separate fragments without contending on shared counters. Excess work is dropped, with one fixed diagnostic per process per minute. Unflushed telemetry is lost on hard termination. Completeness and global drop counts are unknown. Durable evidence starts at the first persisted observation.
- A separate Mongo client has two pooled connections, one concurrent handshake, a 1 s selection/connect budget and 1.5 s driver operation timeout. Readiness checks cache success for five minutes and failure for 30 seconds. At most four concurrent reminder telemetry writes are admitted. Start writes begin independently after authentication. Terminal writes run after the response and can reconstruct an absent start. Detection of a hard stop depends on whether the start write landed. Driver timings and function lifecycle limits bound background work separately from the user response.
- Reminder slots follow the configured 15-minute UTC cadence with 20 minutes of grace. Scheduled completions are counted at most once per slot. Partial, partial batch, lease busy and failed attempts remain distinct. A slot with an observed start and no terminal evidence can be overdue. A missing observation remains unknown. Redeliveries are separate actual attempts under the same hashed dispatch ID.
- The quiz status requires at least 20 samples within 30 minutes. It degrades at 5% recorded server errors or p95 above 1,000 ms. Old evidence is stale after 30 minutes. MongoDB has timing evidence but remains unknown without a connectivity probe. A recent completed scheduled run supports scheduler health. Coverage warnings and missing sources remain visible.
- API incidents group consecutive complete five-minute UTC intervals with at least 20 recorded requests each and a shared threshold breach. Reminder incidents group verified failures and overdue observed starts into 15-minute intervals. Incident status is omitted because recovery is not tracked. The UI shows at most eight incidents and ten job attempts.
- Reads use date-leading hints and inspect at most 12,001 metric fragments and 1,201 reminder records. Saturated reads show partial coverage and omit the oldest split metric minute. Result charts merge 5-, 60- or 360-minute intervals. Local query plans use the expected indexes. Representative staging plans and workload baselines are still required.

### Operator-only provisioning and activation

Use a dedicated telemetry database named in `ABII_PERF_MONGODB_URI`. Keep `ABII_PERF_COLLECTION` unset until approval and validation. No model auto-indexing or DDL runs in application code. Provision these collections and exact indexes through the operator account, after separate approval.

| Collection | Index name | Key and TTL |
|---|---|---|
| `performance_metrics_v1` | `_id_` | Unique built-in `{ _id: 1 }` |
| `performance_metrics_v1` | `performance_bucket` | `{ bucket: -1 }` |
| `performance_reminder_runs_v1` | `_id_` | Unique built-in `{ _id: 1 }` |
| `performance_reminder_runs_v1` | `performance_started` | `{ startedAt: -1 }` |
| Both collections | `performance_expiry` | `{ expiresAt: 1 }`, `expireAfterSeconds: 0` |

`expiresAt` is the UTC minute start for a metric fragment or the attempt start for a job, plus exactly 691,200 seconds. Both reads filter expiry even before the asynchronous TTL monitor runs. Do not use partial or sparse indexes. The dedicated runtime user needs `find` and `listIndexes` on both collections, `insert` on metrics, and `insert` plus `update` on reminder runs. Use Atlas network access controls and TLS. Keep the URI server-side. Only approved administrators can read these reports through the existing Abii admin gate. No telemetry ingestion route exists.

Estimate storage using observed staging throughput. A quiet isolated instance can emit one fragment per request. Coalescing can reduce that to one per 64 requests within a minute. Each reminder attempt normally uses two updates and one stored document. One schedule generates 96 expected slots per day, about 768 slots over the retention window. Eight times daily fragment count estimates retained fragments before TTL lag. Measure BSON and index bytes, write utilization, timeout/drop diagnostics, and read-cap frequency in staging. At 12,000 fragments across seven days, about 1,700 fragments per day exhaust the longest read window. Confirm usable coverage at expected peak load before activation.

After provisioning and testing staging indexes, confirm the deployment supports Next.js `after()` on both API and scheduled handlers. Compare request and reminder results with collection on and off. Deploy the feature disabled, add the scoped URI, then set `ABII_PERF_COLLECTION=1` on the approved deployment. Monitor coverage and storage usage. To stop writes, unset the flag and redeploy. Keep the URI for read-only access to retained history, or unset it to disable reads. Stop collection and drain active deployments before changing collections or indexes. Leave the existing TTL policy to expire retained telemetry. Independent probes require a separate approved source and read integration.

## Phase 8 security evidence and rollout

The administrator-only `/admin/security` page and its server-rendered details use the existing UI gate and live MFA-backed session check. It uses private no-store admin responses and adds no security-data API, public writer, or mutation capability. The two existing collections remain authoritative. Privileged changes and administrator sign-in/sign-out continue using the existing transaction. The explorer includes only the committed audit collection for those actions and skips correlated security shadows. Administrator sign-in and revocation appear in the explorer. The Administrative Actions KPI counts other committed changes, including provisioning, MFA changes, recovery, suspension and reactivation. These are application-level append-only conventions. Database operators can still change records.

| Signal | Coverage |
|---|---|
| Login failures | Forward-only counted password rejections for ordinary and administrator flows. Submitted identifiers, credentials and rejected identity candidates are omitted. MFA rejections from matched password-bound challenges are a separate event. Malformed requests and origin rejections are outside the counted login series. |
| Successful authentication | Learner session creation after password login and email verification. Administrator MFA success comes from its existing committed audit transaction. Pending password challenges are uncounted. |
| Rate limiting | The shared fixed-window checker records actual rejections for allowlisted authentication and privileged-operation scopes. Sequential checks stop at the first rejection. Missing proxy metadata and resend cooldown responses have no count evidence. `AuthRateLimit` counters are used only for enforcement. |
| Account security | Password changes and completed resets record verified learner IDs after the underlying write or transaction succeeds. Only a stable opaque event ID survives from the operation identity. Admin-session revocation uses committed audit records. Recovery-code failures, failed administrator challenges and verified step-up denial are recorded where server decisions supply evidence. |
| History | Old denial records represent at most one retained observation per kind per minute. They have unknown attempt counts and actor attribution in the explorer. They are excluded from counted trends and thresholds. Existing privileged notes are restricted to the original audit store and omitted from all Phase 8 projections. |

Diagnostic writes are enabled explicitly with `ABII_SECURITY_EVENTS_ENABLED=true`. The writer reuses the application security database through an isolated three-connection MongoDB driver pool with 1 s selection and connection timeouts and a 1.7 s operation timeout. It verifies the existing 90-day TTL index before admitting writes. Next.js `after()` handles HTTP delivery. The bounded fallback serves existing operator flows without a response lifecycle. At most two groups of 64 observations flush per instance after 125 ms. Fixed UTC minute/type/scope IDs collapse bursts into one count-bearing record per series per minute. Atomic increments and the built-in unique _id index prevent lost updates between concurrent writers. MongoDB retryable single-document operations preserve driver retry identity. The application does not replay ambiguous write failures. Individual reset and password-change observations have stable idempotent IDs. Rejected requests are counted only when the observation persists. A full queue, write failure, or runtime termination can cause gaps. A fixed diagnostic is emitted at most once per instance per minute. Missing or silent intervals cannot prove continuous collection. Legacy denial recording continues when the forward writer is disabled.

The period defaults to 24 hours and supports 7 and 30 days. Both custom UTC dates are required, with up to 30 days per query within the retained audit history. The open UTC minute is omitted. The explorer scans bounded slices of 600 chronological candidates from each source and displays up to 20 matching rows, ordered by date, source tie-break and database _id. A sparse page may offer an older page with zero current matches. Cursors authenticate the filters and pinned snapshot, and expire in 30 minutes. Exact safe IDs use the primary or audit correlation index. Summary reads inspect at most 12,001 records per source and disclose truncated results. A separate source can remain visible on a partial read. Invalid input, read timeouts and unavailable indexes return generic UI feedback.

Verified alerts require complete five-minute UTC intervals. Password failure warnings require at least 10 recorded rejections in each of two consecutive intervals. An interval also qualifies at five MFA rejections, 25 limiter rejections, or three fresh-session administrator step-up denials. Contiguous qualifying intervals group into one warning. The dashboard shows the five most recent and links to filtered evidence. Positive observations can support warnings under partial coverage. Missing data does not establish an attack, verified recovery, critical severity, or an all-clear.

### Operator-only index verification

Phase 8 requires separate operator approval for query indexes and collection activation. The app declares no new automatic DDL and the authorization and provisioning prerequisites from Phase 2 retain their existing index requirements. Inspect production indexes read-only before rollout. Verification during implementation used an isolated replica set and a bounded query plan, with no inspection of a live Atlas deployment.

| Existing collection | Verify or provision after approval |
|---|---|
| `adminauditlogs` | Keep `{ occurredAt: 1 }` TTL at 31,536,000 seconds, existing target/time index, and built-in unique `_id_`. Add `security_timeline` on `{ occurredAt: -1, _id: -1 }` and `security_correlation` on `{ correlationId: 1 }`. |
| `adminsecurityevents` | Keep `{ occurredAt: 1 }` TTL at 7,776,000 seconds, existing kind/time index, and built-in unique `_id_`. Add `security_timeline` on `{ occurredAt: -1, _id: -1 }`. |
| `authratelimits` | Preserve the existing unique key/window and `expiresAt` TTL indexes. No reporting access is required. |

Use standard visible, non-partial indexes with simple collation for the Phase 8 queries. The application database user needs scoped read access to both collections and existing authorized audit write privileges. Forward collection needs scoped `listIndexes`, `insert` and `update` on `adminsecurityevents`. Confirm indexes and query plans on representative staging data, then verify normal authentication decisions during an injected log-write failure. Enable forward observations on an approved deployment and record the UTC activation time. Disable the flag and redeploy to stop the new producer. Existing stored evidence remains queryable until its established TTL expires. No backfill or retention migration is required.
