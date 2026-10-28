# Folder organization

Subject Topics tabs now show a responsive Folder overview. Each Folder card links to `/subjects/[subjectId]/folders/[folderId]`, where the existing Topic cards and management actions operate on topics from that Folder only. `/subjects/[subjectId]/folders/unfiled` is a virtual view for topics without a Folder; it does not create a Folder record.

The Folder workspace validates the authenticated owner, parent Subject, and Folder relationship before rendering. Topic list requests accept `folderId` and apply that filter under the authenticated subject scope. Folder summaries include topic and flashcard counts, and the overview exposes Unfiled Topics when present.

The Folder hero uses the same pastel treatment and the existing `/dashboard-hero/my-subjects.png` mascot as the Subject hero. Topic creation and movement continue to use the existing topic APIs and preserve topic identity, flashcards, and study history.
