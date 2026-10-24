# Abii database models

These Mongoose models are server-only and use `timestamps: true` (`createdAt` and `updatedAt`). They reuse `mongoose.models.*` before compiling a model, which prevents `OverwriteModelError` during Next.js development hot reloads.

- `User.ts` — trimmed name, lowercase/trimmed email, password hash excluded from normal query results, unique email index.
- `Subject.ts` — subject owner and name; owner index.
- `Flashcard.ts` — owner, subject, question, answer, optional hint, and type; compound owner/subject index.
- `ReviewRecord.ts` — owner, flashcard, correct/wrong result, question type, review dates; owner/card/next-review index.
- `index.ts` — convenient server-side exports.

Import models from server components, route handlers, or server actions only. Do not import them from files marked `"use client"`. The `server-only` guard helps Next.js catch accidental client imports.

Phase 1 adds `Topic.ts` and exports `Topic` / `TopicDocument`. Topics reference an
owner and subject, have a required trimmed 1–100 character name, optional
description (500 characters), nonnegative integer position, and timestamps.
`normalizedName` is derived with Unicode NFKC normalization, trimmed/collapsed
whitespace and locale-independent lowercase. The unique
`{ userId, subjectId, normalizedName }` index enforces case-insensitive uniqueness
within an owned subject; `{ userId, subjectId, position }` supports sorting.
Document validation and supported query updates derive the key. Use validated
document saves for other changes; raw collection/bulk writes bypass middleware
and must enforce these invariants themselves. Database duplicate-key errors are
identified by `isDuplicateTopicError`; callers must handle them as conflicts, not
as successful writes. The migration re-reads the matching General topic on a race.

Flashcard now has an optional `topicId` reference and an owner/subject/topic index.
Both `standard` and `items` (Enumeration) values are unchanged. Topic is optional
during the transition, so existing creation and quiz paths continue to work.
Mongoose refs are not foreign-key constraints: the migration validates existence
and ownership; the Phase 2 Topic API enforces those constraints for its writes.
Reviews and quiz sessions are unchanged; historical
sessions need no topic metadata and retain their stored question snapshots.

See [migration instructions](../scripts/README.md) for dry runs, index deployment,
production safeguards, partial-failure recovery, and idempotency verification.

Phase 2 adds an internal, normally unselected `Subject.topicRevision` counter for
serializing Topic transactions without changing subject timestamps. See the
[Topic API contract](../lib/topics/README.md) for CRUD, ETags, ordering, safe transfer,
and transaction deployment requirements.

MongoDB indexes are declared in the schemas. Mongoose normally creates declared indexes when a model initializes; for production deployments, consider running index creation as a controlled deployment step rather than relying on automatic index creation.
