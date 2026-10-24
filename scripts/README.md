# Topic migration (Phase 1)

Use Node 20.19+ (required by the temporary MongoDB test dependency). The CLI uses
the same server-only Mongoose models as the app, with the `react-server` condition.
It never loads `.env.local` or falls back to `MONGODB_URI`.

Start with a backup restored into an isolated development database. In PowerShell:

```powershell
$env:TOPIC_MIGRATION_URI = 'mongodb://127.0.0.1:27017'
$env:TOPIC_MIGRATION_DB = 'abii_topic_migration_test'
$env:TOPIC_MIGRATION_ENV = 'test'
npm run migrate:topics -- --dry-run
```

Dry run is the default and makes no document, collection, or index writes. It
validates all existing topic and flashcard parents/owners, reports planned topic
creation and assignments, and prints before/after counts. Invalid references or
duplicate/inconsistent topic keys abort preflight. Missing and null topic IDs are
unassigned; malformed non-null IDs are errors, never silently reassigned.

After reviewing a clean dry run, apply to the selected nonproduction copy:

```powershell
npm run migrate:topics -- --apply
npm run migrate:topics -- --apply
npm run migrate:topics -- --dry-run
```

The second apply must report zero created topics, zero assigned cards, no errors,
and `idempotent: true`; the final dry run must plan zero changes. The apply summary
also verifies no unassigned cards remain, which means a subsequent run has no work.
`npm test` exercises repeated runs against an automatically started, isolated
MongoDB process, never an environment-provided database. The initial test run may
download a MongoDB executable and needs network access.

Before any real migration, back up and verify restoration, stop application writes
(including subject/user deletion and flashcard creation), and avoid concurrent
migration processes. This is a resumable migration, not a global transaction.
Each assignment conditionally updates only still-unassigned cards. A partial
failure retains completed work, prints the affected subject and exits nonzero;
correct the cause and rerun. An empty General topic left by an interrupted run is
reused. The unique index and duplicate-key recovery prevent duplicate General
topics. No collection or index is dropped, and no automatic rollback deletes data.

Counts and SHA-256 digests of all non-topic documents (excluding only flashcard
`topicId`) are compared before/after, so timestamps, content, reviews, snapshots,
and mastery inputs must stay identical. Concurrent application writes or the
existing QuizSession TTL index can cause verification to fail; schedule a quiet
window and account for existing session expiry. The script does not change TTL
behavior. Full scans trade speed for integrity; budget time for large databases.

Production requires separate explicit operator authorization. Set the environment
to `production` and only then use `--production-authorized` (also required for a
production dry run). The environment label is an operator assertion, not automatic
production detection: verify the URI and database independently. Credentials
should have access only to the intended database. No production run is part of
implementing Phase 1.

Indexes added on apply: `topic_owner_subject_name_unique` (unique owner/subject/
normalizedName), `topic_owner_subject_position`, and `flashcard_owner_subject_topic`.
Existing indexes are retained. Pre-existing conflicting indexes need manual review;
the script will not replace them. On app deployments with automatic index creation
disabled, run this controlled index step before enabling Topic writes.
