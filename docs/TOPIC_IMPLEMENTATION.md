# Topic Management: implementation and QA record

## Feature overview

The Topic feature organizes study cards as:

```text
User
└── Subjects
    └── Topics
        └── Flashcards
            ├── Standard
            └── Enumeration (`items`)

Review Setup
├── All Subjects
├── Specific Subject
└── Specific Topic

Quiz modes
├── Multiple Choice
├── Identification
├── True or False
└── Mixed / Random

Mastery
├── Topic
├── Subject
└── Overall
```

## Data model and migration

`Topic` belongs to one user and Subject and has a normalized unique name,
description, sort position, and timestamps. `Flashcard.topicId` is optional in
the schema to keep legacy reads compatible. After migration, normal flashcard
creation requires a Topic belonging to the same user and Subject. The stored
`standard` and `items` formats are unchanged.

The idempotent migration assigns unassigned cards to a `General` Topic for
their original Subject. It preserves card IDs/content/timestamps and all review
and session documents. The CLI defaults to dry-run, verifies relationships and
before/after counts/digests, and requires explicit selection of a safe database.
Automated migration runs use temporary in-memory MongoDB. **No production
migration was executed for this implementation.** See
[`scripts/README.md`](../scripts/README.md) before running it in any real
environment.

## APIs and user workflows

Topic CRUD endpoints:

- `GET` and `POST /api/subjects/:subjectId/topics`
- `GET`, `PATCH`, and `DELETE /api/subjects/:subjectId/topics/:topicId`

Every route verifies authentication, ownership, and parent relationships.
Topic writes use ETags and transactional parent locking. Populated Topic
deletion requires explicit transfer to a destination in the same Subject;
there is no destructive card-deletion option.

The Subject page opens on Topics and retains All Flashcards, Progress, and
Settings. Topic Details reuse the existing flashcard editor and provide direct
Topic or Subject links into the shared Review Setup. Subject and Topic counts
are database-backed. Refreshes after saves, moves, renames, deletion, and quiz
navigation use existing router/server refresh behavior.

Review Setup accepts All, Subject, and Topic scopes. New sessions store
optional scope/Topic name metadata and immutable question snapshots. Older
sessions without those fields remain readable. A Topic rename does not rewrite
historical session metadata.

## Quiz and mastery rules

Selectable quiz modes remain Multiple Choice, Identification, True or False,
and Mixed / Random. Enumeration remains the `items` flashcard format, not a
quiz mode. The existing builder adapts Enumeration cards to complete-list MCQ,
multi-entry Identification, and list-based True/False. Eligibility continues
to require safe distractors where applicable; retries reuse the session's card
set and stored scope.

Mastery is the existing consecutive-correct streak system, not answer
accuracy. A card must complete the streak in every applicable mode and Mixed /
Random. `getSubjectMastery()` loads owned cards, Topics, Subjects, and review
records in batches, computes each card once, then aggregates by Topic, Subject,
and account. Progress uses `mastered / total cards` with consistent rounded
percentages; usable-card counts remain separate. Subject and overall totals
come from underlying cards rather than averages of Topic percentages.

Dashboard, Subjects, Subject Details, Topic Details, Review Overview, Review
Setup, and Progress use the shared mastery calculation. The Progress view also
shows each Topic under its Subject.

## Export and deletion

The authenticated export contains the safe account projection, Subjects,
Topics, flashcards with `topicId`, review history, and completed quiz session
snapshots. Optional historical scope fields are exported as stored. Password
hashes and other users' records are excluded.

Subject deletion transactionally removes owned Topics, cards, reviews, and
active sessions while preserving completed quiz history. Account deletion and
Clear Study Materials remove Topics and related records in a transaction. Clear
Study History remains a separate operation. These writes require a replica set
or sharded deployment. Standalone deployments return 503 without partial
writes.

## Automated QA performed

The repository test command includes all new Topic tests:

- Schema, migration dry-run/apply/idempotency, relationship validation, and
  review/session preservation against isolated MongoDB.
- Topic API validation, ownership, normalized duplicates, ETags, ordering,
  transaction rollback, transfer, and standalone refusal.
- Streak mastery totals and quiz compatibility for Standard and Enumeration.
- Scope/mode matrix across All, Subject, and Topic, including retry rounds and
  server-side grading.
- Authenticated HTTP integration covering Subject/Topic/card creation, moves,
  export, historical sessions, Subject deletion, materials clearing, account
  deletion, and cross-user isolation.
- Existing quiz, audio, and route regression tests.
- Eligibility counts are compared against generated question counts for all 12
  scope/mode combinations.

`npm test` runs against temporary MongoDB instances, never the application
database URI. The Next.js route test starts a local development server and
uses signed test credentials.

### Browser QA status

Visual browser QA was not performed: no browser session was available in this
environment. The listed responsive widths and interactive visual states should
still be checked in a connected browser before treating visual QA as complete.
Build and static checks do not substitute for that review.

## Final verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed; five existing warnings remain |
| `npm test` | Passed; 20 base tests, 17 Topic/schema/mastery tests, and 1 authenticated route integration test |
| `npm run build` | Passed |
| `git diff --check` | Passed |

## Phase 9 files

**Created:** `docs/TOPIC_IMPLEMENTATION.md`.

**Updated:** `README.md`, `models/README.md`, `lib/topics/README.md`,
`components/subjects/README.md`, `components/subjects/topic-detail-client.tsx`,
and `scripts/quiz-compatibility.test.ts`.
The Topic Detail review action now opens Topic-scoped Review Setup instead of
showing an obsolete disabled placeholder.

## Remaining advisories

- The schema allows legacy unassigned cards until the operator runs the
  documented migration. No production database state was inspected or changed.
- Flashcard text alone cannot prove that two differently worded Enumeration
  lists are semantically equivalent. Distractors use owned card data and the
  builder rejects normalized duplicate/equivalent lists, but there is no
  semantic knowledge-base validator.
- Visual QA requires a browser session; it remains outstanding as noted above.
