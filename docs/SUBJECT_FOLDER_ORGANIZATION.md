# Subject Folder Organization

## Hierarchy and models

The academic hierarchy is My Subjects → Subject Folder → Subject → Topic Folder → Topic → Flashcards. SubjectFolder is a user-owned collection with a normalized unique name per user, description, ordering position, and timestamps. Subject.subjectFolderId is optional; null or missing means Unfiled Subjects. Existing Folder remains a Subject-owned Topic organizer (Topic.folderId) and is independent.

## API

- GET /api/subject-folders lists the signed-in user's folders with subject, topic, and flashcard totals.
- POST /api/subject-folders creates a folder.
- GET /api/subject-folders/[folderId] reads an owned folder.
- PATCH /api/subject-folders/[folderId] updates its name, description, or position. Mutations require the folder ETag in If-Match.
- DELETE /api/subject-folders/[folderId] requires { "confirm": true } and the ETag. It transactionally unfiles contained subjects and then deletes the folder.

Subject creation accepts optional subjectFolderId; Subject PATCH independently accepts name and/or subjectFolderId. Folder ownership is verified before assignment. Subjects without a folder remain supported.

## Pages and behavior

When at least one Subject Folder exists, /subjects displays compact folder summaries and Unfiled Subjects. With no folders, the established All Subjects cards remain and include New Folder. Creating the first Folder refreshes into the organized overview without changing existing Subject assignments. /subjects/folders/[folderId] displays a folder's subjects; /subjects/folders/unfiled is a virtual group and is not a database record. Subject detail and Topic Folder routes remain independent.

The shared Create Subject modal offers Unfiled Subjects and all owned Subject Folders, defaulting to the current context. Subject cards link to Subject Detail independently from their Move Subject action. Moving submits only subjectFolderId, removes the Subject immediately from the current list, preserves study records, and refreshes server summaries.

The main overview search is debounced and searches Folder names/descriptions plus Subjects across folders. Subject results show their parent folder and link directly to Subject Detail. Folder overview statistics use grouped aggregation; the overview skips detailed Subject mastery/card construction while Folders are present. The Subject Folder page uses a dedicated shell-wrapped subject-folder-detail skeleton with a mascot-shaped placeholder and no mascot image.

Folder deletion never deletes a Subject or its study data. Moving a Subject changes only its organizational reference. Subject IDs, Topic and Topic Folder references, Flashcards, review history, quiz sessions, mastery, and achievements are not altered by folder operations. Folder creation does not emit Subject creation achievement events.

## Security, transactions, and performance

Folder queries and mutations are scoped to the authenticated owner. Names use Unicode NFKC, trimmed/collapsed whitespace, and case-insensitive normalized values. Folder deletion uses the existing required MongoDB transaction helper and does not fall back to partial writes. Folder summaries use grouped aggregation rather than per-folder count queries. Folder detail loads only owned Subjects assigned to that folder and the existing mastery calculation.

## Export and deletion

JSON export includes subjectFolders and exports each Subject's nullable subjectFolderId; Topic Folders continue to export under folders. Clear Materials and account deletion remove Subject Folders inside their existing cleanup transactions.

## Validation

npm run typecheck, npm run lint, npm test, npm run build, and git diff --check were run for the completed implementation. Subject Folder model, count, ownership-scope, transactional unfile, and data-preservation checks are covered by scripts/subject-folders.test.ts. Lint/build may emit existing warnings documented in the final change report.
