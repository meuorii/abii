# Database models

Models are server-only Mongoose schemas, use timestamps where applicable, and
reuse compiled models for Next.js development hot reloads. Import them from
server components and route handlers, never from client components.

## Ownership and relationships

| Model | Main fields / relationship | Notes |
| --- | --- | --- |
| `User` | account identity and settings | Password hash is excluded from ordinary reads. |
| `Subject` | `userId`, name | Owned by one user; has an internal `topicRevision` write lock. |
| `Topic` | `userId`, `subjectId`, name, description, position | Unique normalized name per owner and subject; ordered within its parent. |
| `Flashcard` | `userId`, `subjectId`, optional `topicId`, format, content | Formats remain `standard` and `items` (Enumeration). |
| `ReviewRecord` | `userId`, `flashcardId`, mode, result, review dates | Stores attempts used by the streak-based mastery rules. |
| `QuizSession` | owner, optional scope metadata, question snapshots | Historical snapshots remain readable without topic metadata. |
| `UserBadge` | owner, badge ID, verification dates and compact evidence | Unique owner/badge award; original unlock timestamp is first-write-wins. |
| `AchievementEvent` | owner, idempotency key, event kind, calendar day, compact facts | Append-only durable evidence; contains no question or answer text. |
| `BadgeReconciliation` | one owner record, version, freshness, lease, compact evaluations | Caches reconciliation results and coordinates concurrent runs. |

Mongoose references are not database foreign keys. Application writes validate
owner and parent relationships. The Topic migration checks these relationships
before assigning legacy unassigned flashcards to a `General` Topic.

## Indexes

- Topics: unique `{ userId, subjectId, normalizedName }` and sorted
  `{ userId, subjectId, position }` indexes.
- Flashcards: `{ userId, subjectId }` and
  `{ userId, subjectId, topicId }` indexes.
- Reviews and quiz sessions retain their owner / lookup / TTL indexes.
- Reviews also have `{ userId, reviewedAt }` for owner-scoped incremental reconciliation checks.
- User badges use unique `{ userId, badgeId }` and owner/unlock ordering indexes.
- Achievement events use unique `{ userId, idempotencyKey }` plus owner/kind/day lookup.
- Reconciliation uses unique `{ userId }` and an owner/creation lookup for incremental freshness checks.

Achievement event history is the canonical source for derived counts, so there are
no independently incremented counters to drift. Clearing study history or study
materials deletes those activity events but leaves already verified badge awards
intact and removes their supporting evidence. Account deletion removes events
and awards together. This preserves the permanence of earned badges while
honoring explicit erasure of activity evidence.

Study activity dates use the user's IANA `settings.studyTimezone`; legacy users
without a value use UTC. Stored historical UTC timestamps must be converted using
the timezone policy available at reconciliation time. Missing dates are never
inferred. Reconciliation is an explicit backfill operation and must use stable
event keys; no existing event is synthesized automatically in this phase.

Badge reconciliation is versioned (`1`), cached for six hours, and refreshed
when a newer durable activity event exists. A short per-user lease prevents
concurrent full scans. The authenticated `GET /api/badges` route is the automatic
entry point; the controlled `reconcile:badges` script defaults to dry-run and
requires `--apply` to write awards. Completed quiz sessions still expire on the
existing TTL. Only surviving sessions and durable compact completion events
support quiz score/date/resume history; missing older sessions are treated as
unavailable and never reconstructed from unrelated review records.

The first applied reconciliation stores a compact per-user baseline (counts,
stable content/session IDs, distinct subject IDs, study day keys, qualifying
quiz score summaries, and mastery threshold subject IDs). Future metrics add only post-baseline activity
events/reviews to that snapshot, so ordinary card deletion or history TTL does
not erase verified lifetime progress. Explicit history/material erasure removes
the baseline and cached evaluations along with activity evidence.

For production, apply declared indexes as a controlled database deployment
step. Do not use index synchronization that drops unrelated indexes.

See [Topic migration instructions](../scripts/README.md) and the
[Topic API contract](../lib/topics/README.md).
