# Subjects and Topics UI

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
