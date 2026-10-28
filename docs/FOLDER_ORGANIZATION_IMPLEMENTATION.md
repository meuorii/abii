# Folder organization

Folders optionally group topics within a subject. Flashcards remain attached to their existing topics; no folder review scope or folder mastery is introduced. Missing or null topic `folderId` means unfiled. Topic names and positions remain subject-wide.

The Folder collection stores owner, subject, normalized name, optional description, position and timestamps. Unique owner/subject/normalized-name and owner/subject/position indexes support uniqueness and ordering. Names use NFKC, whitespace normalization and lowercase for comparison. Topic has an optional folder reference and a folder lookup index; no data migration is needed.

Authenticated endpoints under `/api/subjects/:subjectId/folders` support list and create; `/:folderId` supports read, patch and delete. Updates and confirmed deletions require an `If-Match` timestamp ETag. Creation appends; position updates reorder. Folder and topic mutations acquire the subject's topic revision lock in a required transaction. Folder assignments validate owner and subject in that transaction. Deletion clears topic references and deletes the folder atomically; flashcards, review records and quiz snapshots are untouched. Transaction support requires a replica set or sharded MongoDB deployment.

Folder counts are derived from topics and flashcards. Subject and account deletion and clearing study materials remove folders; clearing history does not. Exports include folders and topic folder IDs, with legacy missing IDs represented as null.

`scripts/folders.test.ts` covers normalization, schema validation, indexes, optional topic folder payloads, ownership boundaries, counts, stale versions, transactional rollback and preservation of cards and an active quiz snapshot. Broader folder API, concurrency and UI regression coverage remains needed. Folder search temporarily expands matching groups. Expansion is local to the page.
