# Subject and Topic UI

Subject details open on Topics by default. The other sections keep the existing
subject flashcard list and CRUD, progress, and settings behavior. Subject cards
display topic counts read from the database and preserve their existing mastery
metrics.

Topic cards show the backend flashcard total, description, and accessible edit,
delete, and view actions. Topic mastery is not displayed yet because the backend
does not provide topic mastery data. Creating or editing topics uses the shared
modal and toast components. Deleting an empty topic asks for confirmation;
deleting a populated topic requires selecting another topic so every card remains.

Topic detail reuses `FlashcardEditorModal` and existing flashcard endpoints. New
cards include an optional topic ID, which the server validates against the current
owner and subject; editing or deleting cards follows existing behavior. Search and
type filters are client-side. Topic scoped review is not available yet; the page
offers subject review and labels its topic review control as unavailable. No review
mastery numbers are inferred.

The Topic API currently has no UI reordering control, although the backend supports
position updates. The Subject cards, topic cards, and detail list use responsive
one, two, or three column layouts and wrap action controls on narrow screens.
Shared `Modal` provides focus trapping, Escape handling, and focus restoration.

Automated responsive checks: run `npm run typecheck`, `npm run lint`, `npm test`,
and `npm run build`. Visual browser review was not available in the implementation
environment, so those commands do not constitute visual QA.
