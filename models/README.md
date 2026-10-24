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

Mongoose references are not database foreign keys. Application writes validate
owner and parent relationships. The Topic migration checks these relationships
before assigning legacy unassigned flashcards to a `General` Topic.

## Indexes

- Topics: unique `{ userId, subjectId, normalizedName }` and sorted
  `{ userId, subjectId, position }` indexes.
- Flashcards: `{ userId, subjectId }` and
  `{ userId, subjectId, topicId }` indexes.
- Reviews and quiz sessions retain their owner / lookup / TTL indexes.

For production, apply declared indexes as a controlled database deployment
step. Do not use index synchronization that drops unrelated indexes.

See [Topic migration instructions](../scripts/README.md) and the
[Topic API contract](../lib/topics/README.md).
