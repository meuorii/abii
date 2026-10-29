# Subject Folder Organization

## Hierarchy and models

The academic hierarchy is My Subjects → Subject Folder → Subject → Topic Folder → Topic → Flashcards. SubjectFolder is a user-owned collection with a normalized unique name per user, description, ordering position, and timestamps. Subject.subjectFolderId is optional; null or missing means Unfiled Subjects. Existing Folder remains a Subject-owned Topic organizer (Topic.folderId) and is independent.

## API

- GET /api/subject-folders lists the signed-in user's folders with subject, topic, and flashcard totals.
- POST /api/subject-folders creates a folder.
- GET /api/subject-folders/[folderId] reads an owned folder.
- PATCH /api/subject-folders/[folderId] updates its name, description, or position. Mutations require the folder ETag in If-Match.
- DELETE /api/subject-folders/[folderId] requires { "confirm": true } and the ETag. It transactionally unfiles contained subjects and then deletes the folder.

Subject creation accepts optional subjectFolderId; Subject PATCH accepts subjectFolderId alongside its name. Folder ownership is verified before assignment. Subjects without a folder remain supported.

## Pages and behavior

When at least one Subject Folder exists, /subjects displays compact folder summaries and Unfiled Subjects. With no folders, the established All Subjects cards remain. /subjects/folders/[folderId] displays a folder's subjects; /subjects/folders/unfiled is a virtual group and is not a database record. Subject detail and Topic Folder routes remain independent.

Folder deletion never deletes a Subject or its study data. Moving a Subject changes only its organizational reference. Subject IDs, Topic and Topic Folder references, Flashcards, review history, quiz sessions, mastery, and achievements are not altered by folder operations. Folder creation does not emit Subject creation achievement events.

## Security, transactions, and performance

Folder queries and mutations are scoped to the authenticated owner. Names use Unicode NFKC, trimmed/collapsed whitespace, and case-insensitive normalized values. Folder deletion uses the existing required MongoDB transaction helper and does not fall back to partial writes. Folder summaries use grouped aggregation rather than per-folder count queries. Folder detail loads only owned Subjects assigned to that folder and the existing mastery calculation.

## Export and deletion

JSON export includes subjectFolders and exports each Subject's nullable subjectFolderId; Topic Folders continue to export under folders. Clear Materials and account deletion remove Subject Folders inside their existing cleanup transactions.

## Validation

npm run typecheck passed after implementation. The repository's automated suite and build were not run in this change.
