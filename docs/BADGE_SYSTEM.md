# Achievement Badge System

The badge system uses the definitions in `lib/badges/catalog.ts` as its source of truth. Server-side metrics and reconciliation evaluate those definitions; page components display the returned results and do not award badges.

## Catalog

| Badge | Category | Rarity | Requirement |
| --- | --- | --- | --- |
| Hello, Abii! | Getting Started | Common | Create one subject. |
| Card Creator | Getting Started | Common | Create 10 flashcards. |
| Quiz Rookie | Getting Started | Common | Complete one quiz. |
| Little Explorer | Getting Started | Common | Create flashcards in 3 distinct subjects. |
| Getting Into Rhythm | Study Consistency | Uncommon | Study on 3 consecutive calendar days. |
| Weekly Wonder | Study Consistency | Uncommon | Study on 7 consecutive calendar days. |
| Dedicated Otter | Study Consistency | Rare | Study on 30 consecutive calendar days. |
| Study Superstar | Study Consistency | Rare | Complete quizzes on 50 distinct calendar days. |
| Sharp Mind | Quiz Performance | Uncommon | Score at least 80% on the first attempt of a quiz with 10+ original questions. |
| Perfect Pearl | Quiz Performance | Rare | Score 100% on the first attempt of a quiz with 10+ original questions. |
| Recall Detective | Quiz Performance | Uncommon | Answer 100 qualifying quiz questions correctly. |
| Enumeration Expert | Quiz Performance | Rare | Fully answer 10 enumeration questions correctly. |
| Finish Line | Quiz Performance | Uncommon | Resume an unfinished quiz and complete that same session. |
| Growing Knowledge | Mastery | Common | Reach at least 25% mastery in a non-empty subject. |
| Halfway Genius | Mastery | Uncommon | Reach at least 50% mastery in a non-empty subject. |
| Memory Pro | Mastery | Rare | Reach at least 75% mastery in a non-empty subject. |
| Mastermind Abii | Mastery | Legendary | Reach genuine 100% mastery in one non-empty subject. |
| Ultimate Scholar | Mastery | Legendary | Reach genuine 100% mastery in 5 distinct non-empty subjects. |

Categories are `getting-started`, `study-consistency`, `quiz-performance`, and `mastery`. Rarities are `common`, `uncommon`, `rare`, and `legendary`.

## Artwork

`lib/badges/images.ts` maps each stable badge ID to its two achievement images:

- Color artwork: `public/badges/unlocked/*.png`
- Monochrome locked artwork: `public/badges/locked/*.png`
- Rarity medals: `public/rarity-badges/{common,uncommon,rare,legendary}.png`
- Badges page mascot: `public/dashboard-hero/badges.png`

The canonical `hello-abii` ID deliberately maps to the existing `hello-abi-unlocked.png` and `hello-abi-locked.png` filenames. Rarity medals are separate from badge artwork. `BadgeImage` uses Next Image with contained, square artwork.

## Persistence and ownership

- `UserBadge` stores one permanent award per `{ userId, badgeId }`, protected by a unique index. The first successful insert determines its unlock date and evidence.
- `AchievementEvent` is an append-only compact evidence ledger with a unique `{ userId, idempotencyKey }` index. It stores verified dates, stable IDs, counts, and scores; it does not store question or answer text.
- `BadgeReconciliation` stores a versioned per-user evaluation cache and historical baseline. Its lock fields prevent concurrent full reconciliations for one account.
- `User.settings.featuredBadges` stores independent `dashboard` and `progress` selections and customized flags. Each list is limited to three unique official badge IDs. The repository validates that every selected ID has a corresponding earned `UserBadge` record.

All repository and API reads use the authenticated owner's ID. The browser cannot choose an owner or directly create an earned badge.

## Historical reconciliation

`lib/badges/metrics.ts` calculates current inventory, retained activity events, surviving completed quiz sessions, review history, and mastery using the existing `getSubjectMastery()` service. On the first reconciliation, a baseline records the verified minimum available at that time so later events do not double count it. Existing current subjects/cards and surviving records may prove minimums; expired quiz sessions cannot prove missing quiz counts, dates, scores, resume completions, or enumeration results.

Reconciliation runs on authenticated badge reads when its cache is stale or new evidence exists. The freshness window is six hours; new events/reviews invalidate the cache. Learning-action hooks request a forced evaluation after a successful write. Awards are idempotent, and pre-existing earned records remain permanent.

For a controlled batch reconciliation, the script defaults to a dry run:

```sh
npm run reconcile:badges
npm run reconcile:badges -- --apply --batch-size=100
```

The script reads the application's configured MongoDB connection from the environment; no credentials are embedded in the source.

## Learning activity and calculations

Successful subject and flashcard creation, persisted quiz answers, quiz completion, resumed completion, reviews, and mastery milestones feed verified evidence. Duplicate event keys and badge indexes prevent retries from inflating totals. Flashcard edits/moves are not new creations. Quiz score eligibility uses original questions and first-round correctness; retry rounds cannot improve that score. An enumeration question contributes at most one fully-correct event and partial answers do not qualify.

Study days are calendar dates in the user's valid IANA `settings.studyTimezone`. Existing accounts without a valid preference use UTC. Timestamps are converted to that timezone before deduplication; consecutive keys use calendar-day arithmetic, so month boundaries and daylight-saving changes do not use elapsed 24-hour intervals. Only persisted review or qualifying quiz activity counts as study activity.

Mastery is the app's existing consecutive-correct mastery result. Empty subjects never qualify. A 100% milestone requires the nonempty subject's completed requirement count to equal its total requirement count. Once awarded, badge records are not revoked by a streak reset, content edit, or later mastery decrease.

## API

- `GET /api/badges` authenticates the user, reconciles when needed, and returns the catalog with verified earned state, progress, image path, and earned date.
- `GET /api/badges/featured?surface=dashboard|progress` returns a surface's current selected badges and the user's earned badges.
- `PATCH /api/badges/featured` accepts `{ surface, badgeIds }`; it validates authentication, official IDs, uniqueness, the three-badge maximum, and earned ownership before updating only that surface.

The APIs never accept a frontend-supplied user ID. API failures do not fabricate progress or report an award that was not confirmed in MongoDB.

## Pages and selection behavior

`/badges` renders the 18-entry catalog, actual unlocked/locked artwork, filters, collection and rarity summaries, progress, and the reusable details modal. Dashboard's “My Achievements” and Progress's “Achievement Showcase” each display up to three earned badges. Before a user customizes a surface, it defaults to the three most recently unlocked badges (catalog order breaks equal-time ties). A saved empty list is treated as an intentional choice, not as an uncustomized surface.

The selection modal edits a draft and saves only when the user chooses **Save Changes**. Dashboard and Progress preferences remain independent. Featured cards open the same badge-details modal; removing a selection never revokes its award.

After successful learning writes, the client dispatches an in-app signal and a `BroadcastChannel` message. Mounted badge views refetch their compact API payload; there is no polling. The details dialog looks up its selected badge in refreshed state so its image, unlock state, and earned date stay current.

## Expiry and privacy/deletion

Completed `QuizSession` records retain their existing TTL. Compact `AchievementEvent` evidence preserves future quiz milestones after those temporary sessions expire; full quiz questions are not retained for badges.

Explicit study-history erasure removes review records, completed sessions, achievement events, and reconciliation baselines/cache, and removes supporting evidence from earned records while preserving verified awards. Explicit study-material deletion clears achievement activity and removes reviews, sessions, cards, topics, and subjects in the existing required transaction; earned awards remain. Account deletion removes earned badges, events, reconciliation data, learning records, and the user/preferences in its existing required transaction.

## Checks

Run the project's checks from the repository root:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Badge-specific catalog, evaluator, reconciliation, persistence, quiz compatibility, and page filtering tests are included by `npm test` through `test:topics`. The existing authenticated Next route suite covers subject and flashcard API boundaries; there is not yet a dedicated browser-driven badge route test. Route tests start a Next server and should not run concurrently with `next build`, because both use the `.next` output directory. Tests use local/isolated fixtures and MongoDB test infrastructure; they do not require production user data.

## Possible follow-up work

- Add a browser-driven authenticated responsive QA suite using isolated test accounts and a disposable database.
- Add an admin-only reconciliation report/export if operations require per-account audit visibility.
- Consider retention/compaction policies for the compact event ledger only after preserving all required idempotency evidence.
