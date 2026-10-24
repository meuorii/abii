# Topic API contract

All routes require the existing authenticated session. Errors use
`{ "error": string }`. Invalid IDs, missing resources, wrong owners, and
cross-subject Topics return 404; unauthenticated requests return 401.

| Method | Route | Contract |
| --- | --- | --- |
| GET | `/api/subjects/:subjectId/topics` | Lists owned Topics ordered by position, with card and mastery metrics. |
| POST | `/api/subjects/:subjectId/topics` | `{ name, description? }` → 201 `{ topic }`. |
| GET | `/api/subjects/:subjectId/topics/:topicId` | Returns the Topic, counts, mastery metrics, and ETag. |
| PATCH | `/api/subjects/:subjectId/topics/:topicId` | Updates a supported subset of `{ name, description, position }`; requires `If-Match`. |
| DELETE | `/api/subjects/:subjectId/topics/:topicId` | `{ confirm: true, destinationTopicId? }`; populated Topics require same-Subject transfer. |

Public Topic fields include `id`, `subjectId`, `name`, `description`,
`position`, timestamps, `flashcardCount`, and genuine mastery metrics. Mastery
is calculated by the shared streak service; no accuracy-based estimate is
substituted. List counts are grouped, not queried once per Topic.

Names are NFKC-normalized, trimmed, whitespace-collapsed, and case-folded before
the unique owner/subject/name index is checked. Duplicate-key errors return
409. Unsupported fields, invalid types, malformed JSON, and invalid positions
are rejected. Reads are not cached.

## Concurrency and ordering

Single reads and writes use ETags. PATCH and DELETE require the exact current
quoted ETag; stale edits return 409. Creation appends after the highest
position. A requested position is a zero-based index; reordering compacts
positions. Mutations take a parent Subject write lock inside a transaction so
concurrent create/reorder/transfer operations serialize across app instances.

## Deletion and data cleanup

Empty Topics can be deleted after confirmation. Populated Topics cannot be
deleted without choosing another Topic under the same Subject. The operation
transfers cards and deletes the source in one transaction; IDs, content,
timestamps, review records, and quiz snapshots remain unchanged. Destructive
card deletion through the Topic endpoint is unsupported.

Subject deletion transactionally removes its Topics, flashcards, review
records, and active sessions. Completed sessions remain as historical question
snapshots. Account deletion and Clear Study Materials transactionally remove
all owned Topics and associated records. Clear Study History remains separate.

These mutations require a MongoDB replica set or sharded deployment with
transactions. Standalone MongoDB returns 503 without writes. Do not claim an
atomic fallback. The migration instructions are in `scripts/README.md`; the
migration is never automatically run against an application database.
