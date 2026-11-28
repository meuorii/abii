# Subjects and Topics UI

Phase 03 shares a responsive study-statistics component across the subject
library, subject folder, subject detail, topic folder, and topic detail routes.
The library totals cover all owned subjects and cards, including unfiled
subjects; folder and detail metrics remain scoped to their current owner and
collection. The subject detail Progress tab reports review history for that
subject and shows mastery per topic.

Subject and topic detail pages expose search, sorting/filtering, and create
actions within their relevant collection. Standard and Enumeration flashcards
retain their existing storage format and editor behavior; the shared editor
uses a responsive field layout. The page skeletons mirror the live statistics
and collection hierarchy.

My Subjects displays persisted folders under Collections and actual unfiled
subject cards in a separate section. Topic folders start expanded while
remaining collapsible, so assigned and unfiled topics are discoverable without
changing server data. Topic Detail keeps mastery modes and supplementary counts
inside its fourth statistic card; its editor locks topic context for both new
and edited cards. Subject-level editing continues to allow topic selection and
reassignment.

Subject Details opens on Topics. Its All Flashcards, Progress, and Settings
sections remain available. Subject cards show database Topic counts and totals;
mastery comes from `getSubjectMastery()`.

Topic cards provide view, edit, and delete actions, flashcard totals, and
streak-based mastery. The Topic Detail page reuses the shared Flashcard Editor,
supports search and format filters, and links to the common Review Setup for
either the selected Topic or its whole Subject.

Deleting an empty Topic requires confirmation. A populated Topic requires a
destination Topic in the same Subject; associated flashcards are transferred
without changing IDs or review history. Subject deletion removes owned Topics,
cards, review records, and active sessions transactionally while retaining
completed quiz snapshots.

Shared modal, toast, progress, and loading components preserve Abii's existing
design system. Mastery progress includes total and usable card counts so
content-ineligible cards remain visible in the denominator.
