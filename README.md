# Abii — Phase 8: Dashboard

## Included file
- `app/dashboard/page.tsx` — replaces the Phase 6 dashboard with an authenticated, MongoDB-backed dashboard.

## What it does
- Gets the signed-in user from `getCurrentUser()` on the server.
- Loads only subjects and flashcards owned by that user.
- Shows each subject's real flashcard count.
- Counts cards due now from the most recent review record for each card. Cards never reviewed are treated as ready to study.
- Handles empty subjects/cards and database errors without displaying database details to the user.
- Uses the existing `AppShell` and Abii design palette. No dependency changes.

## Routes used
- Add Subject / View all: `/subjects`
- Start Review: `/review`
- Subject card: `/subjects/[subjectId]`

The `/review` and `/subjects/[subjectId]` routes need to exist in your project for those actions to open fully implemented screens. This phase does not create those features. The Add Subject action links to the existing Subjects area because the create-subject form is outside this phase.

## Install
Copy `app/dashboard/page.tsx` into the matching path in your existing project, replacing the old dashboard page.

## Checks
Run:
```bash
npm run lint
npm run typecheck
npm run build
npm run dev
```

Test with:
1. An account with no subjects or flashcards: the dashboard should show a welcoming empty state and zero due cards.
2. An account with subjects and cards: subject counts should match MongoDB; cards never reviewed or whose latest `nextReviewAt` is in the past should count as due.
3. A signed-out browser: `/dashboard` should redirect to `/login`.

I couldn't run the app against your local MongoDB or browser sessions in this environment, so these integration tests remain for you to perform locally.
