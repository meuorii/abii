# Topic API — Phase 2

All routes use the existing signed session cookie and `getCurrentUser`. Errors use
`{ error: string }`. Invalid IDs, missing resources, wrong owners, and topics under
another subject return 404; missing/invalid authentication returns 401.

| Method | Route | Body / result |
| --- | --- | --- |
| GET | `/api/subjects/:subjectId/topics` | `{ topics: Topic[] }`, position then ID order |
| POST | `/api/subjects/:subjectId/topics` | `{ name, description? }` → 201 `{ topic }` |
| GET | `/api/subjects/:subjectId/topics/:topicId` | `{ topic }` and `ETag` |
| PATCH | `/api/subjects/:subjectId/topics/:topicId` | Nonempty subset of `{ name, description, position }` → `{ topic }` |
| DELETE | `/api/subjects/:subjectId/topics/:topicId` | `{ confirm: true, destinationTopicId? }` → `{ success: true, movedFlashcardCount }` |

Public fields: `id`, `subjectId`, `name`, `description` (empty string when absent),
`position`, `createdAt`, `updatedAt` (ISO dates), `flashcardCount`, and
`metrics: { flashcardCount }`. Phase 6 can extend metrics; no mastery percentage is
fabricated. Counts use one grouped aggregation, not a query per topic. Legacy cards
without topicId are excluded from topic counts. Owner IDs and normalized keys are
not returned. Reads are not cached.

Names are NFKC-normalized, trimmed and whitespace-collapsed (1–100 characters).
The shared lowercase key enforces uniqueness within owner/subject. Description must
be a string of at most 500 characters; `""` clears it. Unsupported fields, invalid
types, arrays, null, malformed JSON and empty PATCH objects return 400. Both
pre-check duplicates and database unique-index conflicts return 409.

## Concurrency and ordering

GET-single, POST and PATCH return `ETag: "<updatedAt ISO date>"`. PATCH and DELETE
require the exact quoted token in `If-Match`. List clients can quote `updatedAt`.
Missing tokens return 428, malformed tokens 400, stale tokens 409. After a conflict,
fetch current data and reconcile changes. Timestamps advance even within one
millisecond. Rename/description edits never write flashcards or reviews.

Creation appends after the highest position. PATCH position is the zero-based
destination index within the current list (0 through topic count minus one).
Reordering atomically compacts positions to 0..N-1, including legacy ties. Moved
siblings get new ETags. Deletion can leave gaps; reads remain deterministic and
the next reorder compacts them. All API mutations write-lock the owned Subject via
an internal `topicRevision` counter inside a transaction, serializing competing
creates/reorders/transfers across application instances. The subject's updatedAt
is preserved. Driver retries use fresh state; stale edits return 409.

## Safe deletion

Empty topics require `{ "confirm": true }`. Populated topics return 409 unless a
destination in the same owned subject is supplied. Self-transfer/malformed IDs
return 400; unavailable/unauthorized destinations return 404. In one transaction,
cards move, the source is checked for remaining references, and only the topic is
deleted. Any failure rolls everything back. The destination ETag advances.

Card IDs, contents, timestamps, ReviewRecord documents, active/completed quiz
snapshots and mastery inputs remain unchanged. Destructive card deletion through
Topic endpoints is unsupported; destructive flags return 400. Existing explicit
Subject/Flashcard deletion contracts remain intact. Subject deletion additionally
removes topics after removing the parent; its existing multi-step cascade is not
made atomic by this phase.

## Deployment and integrity boundaries

Topic mutations require a replica set or sharded MongoDB with transactions.
Standalone MongoDB fails closed with 503 and no writes; reads still work. There is
no non-atomic fallback. Use a single-node replica set locally. Deploy Phase 1's
unique owner/subject/normalizedName index, topic sorting index and flashcard
owner/subject/topic index before serving Topic traffic. No migration runs here.

The existing Subject Flashcard create endpoint accepts an optional `topicId` and
checks it belongs to the signed-in owner and same subject. Existing creates without
that field still work. Updates preserve the saved topic. Future movement endpoints
must use the same parent transaction lock and validate the destination.
Direct database writers and migrations bypass the protocol; pause application
writes for migrations as documented in Phase 1. Mongoose refs are not foreign keys.

`npm test` runs real replica-set CRUD/concurrency/rollback tests, standalone refusal,
Phase 1 tests, and an actual Next.js HTTP test with signed cookies and existing
Subject/Flashcard operations. Temporary databases are created automatically; the
app database URI is never used. The HTTP test overrides the server URI and secret,
then stops its local Next dev process. Avoid running it alongside a build or dev
server in the same checkout because Next shares `.next`. First use may download
MongoDB binaries. No UI or quiz grading changes are part of this phase.
