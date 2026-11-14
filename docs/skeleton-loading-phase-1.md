# Authenticated skeleton loading: Phase 1 audit

## Foundation decisions

The authenticated app is an Operate surface: preserve the established pink and white Abii palette, page gutters, route-specific hierarchy, and component geometry. One CSS-only shimmer belongs to every placeholder; composition remains page-owned.

| Token | Value | Use |
| --- | --- | --- |
| `--skeleton-base` | `#F2E7EB` | Placeholder fill |
| `--skeleton-highlight` | `rgb(255 255 255 / 48%)` | Soft sweep |
| `--skeleton-surface` | `#FFF4F7` | Existing pale hero surface guidance |
| `--skeleton-border` | `#F0E5E9` | Existing subtle card border guidance |
| `--skeleton-radius` | `0.625rem` | Default block radius; layout classes may override it |

`SkeletonBlock` owns decorative fill and sweep; width, height, responsive behavior, and radius stay in Tailwind classes. `SkeletonCircle` is a circular convenience. `SkeletonCard` supplies the established white card surface. `SkeletonRegion` owns one concise `role="status"`, `aria-busy="true"`, and hidden announcement. Blocks are `aria-hidden`; there are no fake controls or focus targets. The region uses the implicit polite status announcement and does not add a second live region.

The shimmer uses one `::after` gradient sweep, `translateX(-100%)` to `translateX(100%)`, 2 seconds, linear continuous motion. CSS handles animation without React state or an animation package. Under `prefers-reduced-motion: reduce`, the pseudo-element is static and the base remains visible. The design is restrained; an authored 2 second decorative loading effect is intentionally exempt from the short interaction-motion durations used elsewhere.

## Data and streaming conventions

- Route `loading.tsx` is an ancestor fallback rendered while its segment is pending. It cannot read page-fetched user records or use their counts without changing the data architecture. Route-level counts therefore remain representative layout shapes, never claims about a user's actual collection.
- A client component may size a local loading region from data already held in its state/cache. Do not add a request to tune placeholder count. If no reliable count is available, keep a modest representative count.
- A streamed independent section should keep its parent usable and render a local Suspense fallback. `FeaturedBadgesStream` already follows this pattern. Prefer section-local pending UI for refreshes where surrounding content is usable.
- Distinguish pending, loaded-empty, loaded-content, and error states. Skeletons only represent pending work; after resolution render the real empty state or the existing error/retry UI.
- Preserve server rendering for static placeholders. Keep loading status at the section/page boundary, not on each shape.

## Authenticated route inventory

Audit source: current `app/(authenticated)` route files, the page compositions/components they render, and each existing fallback. Geometry notes are source-verified comparisons; no claim of measured browser pixel deltas is made in this phase.

| Route | Current loader | Actual layout | Verified mismatch / next improvement | Data availability at route fallback | Priority | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| `/dashboard` | `PageLoadingSkeleton` (`dashboard`) | Hero; overall mastery; due review and streak; subjects; streamed featured badges; quick actions | Skeleton instead puts four metrics and two generic panels immediately after hero, and omits the subjects, badges, and quick-action sequence. | Unavailable; representative counts only | High | 2 |
| `/subjects` | `PageLoadingSkeleton` (`subjects`) | Hero, subject actions/search and filters, responsive subject collection | Six cards are representative. Verify hero/action controls and collection spacing against current layout; do not imply six real subjects. | Unavailable | High | 2 |
| `/subjects/[subjectId]` | `PageLoadingSkeleton` (`subject-detail`) | Subject hero with icon/count/mastery, topic/folder organization, flashcards and controls | Current skeleton needs a careful section-order/toolbar review against the loaded page; its invented card rows cannot express actual folder/topic count. | Unavailable | High | 3 |
| `/subjects/folders/[folderId]` | `PageLoadingSkeleton` (`subject-folder-detail`) | Breadcrumb/context, subject-folder hero and action, responsive subject cards | Existing structure includes hero and six cards; the six are representative. Verify current action and card geometry in page-specific reconstruction. | Unavailable | Medium | 3 |
| `/subjects/[subjectId]/folders/[folderId]` | `PageLoadingSkeleton` (`folder-detail`) | Breadcrumb, topic-folder hero, TopicsSection cards/list and local states | Skeleton has breadcrumb/hero and six card rows, but loaded TopicsSection can vary among loading, empty, error, and folder/topic content; static route fallback cannot know the count. | Unavailable at route; local client data available only after mount | High | 3 |
| `/subjects/[subjectId]/topics/[topicId]` | `PageLoadingSkeleton` (`topic-detail`) | Breadcrumb, topic hero, mastery, flashcard toolbar/list, actions | Structure is comparatively specific, but hero minimum height (285–300px desktop) should be compared with the current shared hero and long topic names. | Unavailable | Medium | 3 |
| `/review` | `PageLoadingSkeleton` (`review`) | Review hero, status/summary, due and study sections with actionable card rows | Current fallback uses three metric cards plus generic rows; compare exact count, section order, and hero scale during Phase 2. | Unavailable | High | 2 |
| `/review/setup` | `PageLoadingSkeleton` (`quiz-setup`) | Setup controls and review summary/configuration | Current two-column layout and four option blocks are generic; validate control grouping, responsive stacking, and summary geometry. | Unavailable | Medium | 3 |
| `/review/quiz/[sessionId]` | `PageLoadingSkeleton` (`quiz`) | Session context/progress, question and answer controls, side summary | Current fallback includes a quiz hero image-like silhouette and a 290/320px summary sidebar; verify loaded session geometry and whether all details are present. | Unavailable | High | 3 |
| Quiz completion state | Inline `PageLoadingSkeleton` (`finish`) inside session client | Completion hero, result breakdown, recent questions, next actions | Not a separate route boundary; preserve inline transition. The fallback is extensive and needs a completion-state geometry comparison. | Session data is available in the client only after resolution | Medium | 3 |
| `/progress` | `PageLoadingSkeleton` (`progress`) | Journey hero, summary, progress charts/history, badge preview | Existing skeleton places four metric cards and badge showcase before two chart/list cards; verify that this matches the current progress page's order and chart proportions. | Unavailable | High | 2 |
| `/badges` | `BadgesPageSkeleton` | `BadgeHero`; four fixed-height achievement stats (1 column below 380px, 2 columns from 380px, 4 at xl); collection progress; rarity overview; responsive badge collection | Distinct component had its own pulse palette; shared styling is now integrated. Its fallback hero is 310px tall on mobile while the shared real hero starts at 168px, creating a likely large shift. The fallback stats use 2 columns even below 380px; real stats use 1. It uses 4 rarity cards at `sm`, while the real rarity layout uses 2 until `sm`. | Unavailable | High | 2 |
| `/settings` | `PageLoadingSkeleton` (`settings`) | Settings hero; Study Preferences; Data & Privacy; responsive settings panels and destructive actions | Skeleton groups three left and two right generic cards, while loaded content is two principal panels with preference controls and privacy action rows. Panel density and order differ. | Page has settings after fetch; route fallback cannot access them | High | 2 |
| `/profile` | No dedicated `loading.tsx` | Profile hero/details, profile photo/name/email form, security, danger zone | Missing route boundary; add a page-matched loader in Phase 2. Profile data is loaded by the page and is unavailable to its route fallback. | Unavailable at route fallback | High | 2 |
| `/favorites` | No dedicated `loading.tsx`; page redirects to `/dashboard` | No rendered favorites page | No page loader needed for the current redirect. Revisit only if Favorites becomes a real destination. | Not applicable | Low | No rebuild planned |

`app/(authenticated)/layout.tsx` is the shared shell, not a page loader. It remains in place around route fallbacks. The route tree contains twelve `loading.tsx` files, all mapped above; Badges is separate, and Profile has no dedicated boundary. Favorites currently redirects to Dashboard, so a separate loading page is not applicable. Quiz completion is an inline pending state rather than a route `loading.tsx`.

## Phase backlog

### Phase 2 — main pages (implemented in the current working tree)

- **Dashboard:** implemented the visible hierarchy in source-verified order: hero, Overall Mastery, Due Review and Study Streak, unknown-count Subjects surface, Featured Badges, and Quick Actions. The independent Featured Badges Suspense fallback shares its composition with the route fallback.
- **Subjects:** implemented hero, representative control/search region, and a compact unknown-count collection surface. Route loading cannot know the user's preferred view or folder contents; resolved content and the true empty state remain authoritative.
- **Review:** implemented hero, four fixed summary cards, neutral unknown-count surfaces for Recent Subjects and topic rows, and the Review Progress panel. Empty and error states remain in the resolved page.
- **Progress:** implemented five fixed summary slots, Featured Badges, activity chart with controls/neutral plot/stats, and neutral unknown-count surfaces for performance, practice needs, and recent sessions.
- **Badges:** corrected the shared hero size, four fixed statistic cards (one column below 380px, two from 380px, four at `xl`), collection progress, rarity overview, filters, and one skeleton per entry in the static 18-badge catalog. Unlocked counts and filtered results remain account data and are never inferred.
- **Settings:** implemented the two primary desktop panels in source order, with preference controls/sound area and data/privacy action rows. Mobile stacks those panels.
- **Profile:** added the missing route boundary and represented the hero, account overview, Personal Information, Password & Security, and Danger Zone. Account actions and security behavior are untouched.
- **Favorites:** no work while the route redirects to Dashboard; audit a new destination if product behavior changes.

### Phase 3 — nested pages and quiz workflow

- **Subject Detail:** reconcile hero metadata/mastery, topic and folder areas, controls, and flashcard list.
- **Subject Folder:** compare breadcrumb/hero/action and responsive subject card geometry.
- **Topic Folder:** include the real TopicsSection structure and retain the local empty/error/loading distinctions.
- **Topic Detail:** tune breadcrumb and hero height, mastery, toolbar, flashcard rows, and action region.
- **Review Setup:** map actual setup controls and summary panels at each breakpoint.
- **Quiz Session:** match question/control geometry and session sidebar; do not fabricate session progress/content.
- **Quiz Completion:** tune the existing inline fallback to results, recent questions, and next-action composition.
- **Other nested boundaries:** preserve page-level loading for route transitions and local pending states for independent client data; do not replace a usable page during subsection refresh.

## Verification limits

Phase 1's original source inventory above remains the audit baseline. Phase 2 extends `scripts/skeleton-system.test.ts` to check all seven compositions' ordered sections, the four Badge statistic placeholders and responsive breakpoints, the Profile loading boundary, non-focusable skeleton markup, and reuse of the Featured Badges fallback. `scripts/skeleton-system.browser.mjs` validates the shared shimmer and reduced motion across the eight required viewport widths. The authenticated route browser suite checks loaded-page responsiveness and page geometry; it does not currently capture the loading and loaded states side by side. Therefore, the source-verified structures and CSS foundation are validated, but measured skeleton-to-content geometry comparison remains open for Phase 4.

### Phase 2 verification notes

- All seven main page compositions reuse the Phase 1 CSS shimmer and decorative primitives; their page layouts remain distinct.
- Route fallback collection counts are unknown because the server pages own the pending queries; variable item grids now use a compact neutral collection surface. The static Badge catalog remains a known, fixed 18-item collection. No loading-only data fetch was added.
- The generic collection loading state distinguishes unknown (`null`), known empty (`[]`), and known items; known item placeholders preserve identity and can be capped to the visible window. Dashboard's known preview uses its four-item visible limit when identities are available.
- `TopicsSection` has a local client fetch. Its initial unknown load is compact; after one successful load, a refresh keeps the current collection/empty state visible and announces the refresh instead of replacing known items with a fixed three-card grid.
- Profile identity, Dashboard and Review counts, progress collections, and unlocked Badge totals remain unknown to their route fallbacks until page data resolves.
- No new client boundary, animation dependency, or intentional loading delay was introduced.
- Nested routes and quiz workflows remain assigned to Phase 3; final loading-to-content geometry, transitions, and cross-page browser QA remain assigned to Phase 4.

### Phase 2.1 — collection quantity correction

| Collection | Availability at loading UI | Corrected behavior |
| --- | --- | --- |
| Dashboard Subjects | Unknown in route `loading.tsx`; the authenticated server page loads subjects before rendering `DashboardOverview`, which then shows at most four | No invented subject cards; use a neutral collection surface. If the visible four identities are passed to the composition in a future local boundary, `SkeletonCollection` preserves them and applies a four-item window. |
| Subjects page | Unknown in route `loading.tsx`; subjects and preferred layout are read by the page before rendering `SubjectsClient` | Neutral collection surface; actual loaded list/grid/folder/empty state remains authoritative. |
| Review Recent Subjects and Topics | Unknown in route `loading.tsx`; both lists are assembled in `review/page.tsx` | Fixed summary cards remain; variable collections use neutral surfaces without invented rows. |
| Progress subject/topic performance, practice needs, sessions | Unknown in route `loading.tsx`; these arrays arrive with server-rendered Progress data | Collection placeholders are neutral; chart plot shows axes/grid only, not fabricated activity bars. |
| Featured Badges | Account-specific unlocked/earned list is pending in its local Suspense boundary | Header/layout remains; no badge cards are implied while the earned collection count is unknown. |
| Badges page collection | Static catalog is available synchronously; all catalog entries are shown by default | One placeholder per `BADGE_CATALOG` item (currently 18); unlocked totals remain unknown/account-specific. |
| TopicsSection | Initial client request has unknown count; after first success, current topics and folders remain in component state during refresh | Initial load is neutral; refresh preserves known content and empty states, with one `Refreshing topics…` status. |
| Settings and Profile | Fixed interface structure | No collection-dependent quantity change. |

Root cause: Phase 2 used hardcoded arrays as representative layout counts in route-level skeletons. Those fallbacks are outside the pending server pages and cannot receive the page's query results. Re-fetching counts from the fallbacks would duplicate database work and delay the loading UI. `SkeletonCollection` now treats `null` as unknown, an empty array as known-empty, and a populated array as known data with an optional visible-item limit. The authenticated route fallbacks use the unknown state where data is unavailable.

No account-scoped cache, database query, API endpoint, or other network request was added. The only known repeated count is the static Badge catalog. Local Topics refresh reuses the current component state and existing API request flow.

### Phase 3 — nested study and quiz loading compositions

The nested route fallbacks are implemented in `components/ui/study-page-skeletons.tsx` and selected through the server-renderable `PageLoadingSkeleton` wrapper. They retain the shared skeleton tokens, CSS shimmer, reduced-motion behavior, and one page-level loading status.

| Area | Phase 3 structure | Count/state handling |
| --- | --- | --- |
| Subject Detail | Breadcrumb, subject hero/overview, four decorative tabs, folder controls, topic organization, and flashcard actions | Folder and flashcard collections are neutral unknown-count regions at the route boundary. The fixed tab count reflects the actual four tabs. |
| Subject Folder | Breadcrumb, folder hero/actions, controls, and subject collection | Unknown membership uses the neutral collection fallback; route loader cannot access pending server data. |
| Topic Folder | Breadcrumb, folder hero/actions, controls, and topic collection | Route fallback is neutral. `TopicsSection` retains known topics or a known-empty state only within the matching subject/folder scope. |
| Topic Detail | Breadcrumb, topic hero, fixed mastery structure, card controls, flashcard collection, and study actions | Flashcard count is unknown at route loading; no question/card count is implied. |
| Review Setup | Hero, two fixed review filters, three scope options, configured quiz modes, and summary/action | Fixed controls use their real counts; selected subject/topic and eligibility counts remain neutral until resolved. |
| Quiz Session | Navigation, session/progress area, question card, responsive progress sidebar, and desktop-only Next Up region | Question type and answer option count are unknown, so answer controls are represented by one neutral area. Existing saved answers/results determine the already-answered count for the inline finish fallback. |
| Quiz Completion | Completion hero, results, fixed breakdown categories, recent-question area, and actions | The inline fallback receives only the count of answered questions still present in the current in-memory session; it does not invent results or scores. |
| Subject Detail Folder Overview | Section-local folder collection | Initial unknown count is a compact neutral surface. Loaded content remains visible for same-subject refreshes; data is hidden immediately when the subject scope changes. |

Route-level loading components cannot read the pending page's server-fetched records. No loading-only queries, caches, API requests, changes to quiz lifecycle logic, or artificial delays were added. The quiz completion fallback remains inside its existing `busy && result && isLast && !summary` condition. Session ownership, answer persistence, grading, resume, recovery, retry, sounds, and celebration logic were not modified.

### Phase 3 verification notes

- `npm run test:skeleton`: passed, 17 tests, including route composition order, neutral unknown-count behavior, quiz question neutrality, completion counts, and Subject Detail folder scope handling.
- `npm run typecheck`: passed.
- `npm run lint`: passed with three existing warnings outside the Phase 3 changes (`app-shell.tsx` raw image, and unused eslint-disable directives in `mongodb.ts` and `quiz/normalize.ts`).
- `npm test`: passed, including quiz answer, resume, restart, topic/folder, and skeleton tests.
- `npm run test:quiz-browser`: passed; persisted Due Review retry rounds and stale due-set handling remained intact.
- `npm run test:skeleton:browser`: passed after production build at 320, 375, 390, 430, 768, 1024, 1280, and 1440px; shimmer and reduced-motion paths passed.
- `npm run test:responsive-browser`: passed for the authenticated loaded-page viewport matrix. It does not capture paired loading/content screenshots or force route-level loading boundaries. Measured skeleton-to-loaded geometry comparison remains Phase 4 work.

### Phase 4 verification — 2026-11-14

Added `scripts/skeleton-routes.browser.mjs` and the `test:skeleton:routes` package script. The test creates an isolated MongoDB account, launches the actual Next.js App Router, and uses a local streaming proxy to pause authenticated HTML after the serialized route fallback boundary. This is not a copied skeleton fixture. It captures the loading state, releases the stream, waits for PageEntry/ScrollReveal to settle, captures the resolved UI, measures hero bounds, checks that the loading region is removed, checks for focusable placeholders and browser/hydration errors, and records layout-shift entries. The full route matrix passed against both `next dev` and the optimized `next start` build. The Windows cleanup path sends Next its graceful SIGINT shutdown when process-tree termination is unavailable in the sandbox. Artifacts are written to the OS temp folder, not committed.

The production paired route test passed for all seven main authenticated routes at 1280×900, plus Subject Detail through a real client-side navigation from the isolated Subject Folder fixture. The main-route hero horizontal and top bounds matched exactly; heights were:

| Route | Skeleton hero | Loaded hero | Difference (skeleton − loaded) | Result |
| --- | ---: | ---: | ---: | --- |
| Dashboard | 978×310 | 978×309.2 | +0.8px | Pass |
| Subjects | 970×242 | 970×244 | −2px | Pass |
| Review | 970×265 | 970×282.2 | −17.2px | Pass |
| Progress | 970×250 | 970×259.5 | −9.5px | Pass |
| Badges | 978×250 | 978×252 | −2px | Pass |
| Settings | 978×248 | 978×250 | −2px | Pass |
| Profile | 978×250 | 978×252 | −2px | Pass |

The client-side Subject Detail transition measured a 978×340px skeleton hero versus 978×335.7px loaded (4.3px height difference; top offset −4px from breadcrumb spacing). Its route status was removed after the nested RSC response resumed. The loading/loaded screenshot pair is `subject-detail-client-navigation-loading.png` and `subject-detail-client-navigation-loaded.png` in the temporary artifact folder.

The initial Dashboard measurement found a 55.2px short hero because the placeholder headline occupied one line while the actual heading wraps to two. The skeleton now models both headline lines and reserves a 310px desktop hero; the paired measurement is now within 1px. This changes only the loading composition.

Subjects loading and loaded states were checked at 320, 375, 390, 430, 768, 1024, 1280, and 1440px. Both had zero document overflow at each width. The real Subjects route also passed the reduced-motion check: placeholders stayed visible and the pseudo-element animation became `none`. The seven route captures reported zero `layout-shift` entries during the controlled stream release, and no route status remained after resolution. The shared shimmer computed to `skeleton-shimmer`, 2s, running under normal motion; placeholders were not keyboard-focusable.

The inline Quiz Completion transition was tested through an isolated real quiz session. The test answered the fixture correctly through its three required mastery rounds, held the final finish response, confirmed the completion loading region appeared and result heading remained absent, then released the response and confirmed results replaced the skeleton. Exactly one final finish request was observed. Existing answer/session behavior was exercised; this test does not replace the broader quiz resume/restart suite.

Paired screenshots and `geometry.json` are available under `%TEMP%\abii-phase4-skeleton-routes` on the test machine. They are sanitized fixture data and are deliberately not checked into the repository.

#### Phase 4 validation results

- `npm run test:skeleton:routes` against `next start`: passed; seven main route fallbacks, Subject Detail through a held client-side RSC navigation, and inline completion, with production-stream screenshots and geometry.
- `npm run test:skeleton`: passed, 17/17.
- `npm run test:skeleton:browser`: passed at 320, 375, 390, 430, 768, 1024, 1280, and 1440px; shimmer and reduced-motion fallback passed.
- `npm run test:quiz-browser`: passed, including persisted retry rounds and stale due-set handling.
- `npm run test:responsive-browser`: passed at the complete authenticated viewport matrix.
- `npm run typecheck`: passed.
- `npm run lint`: zero errors; three existing warnings remain in `app-shell.tsx`, `lib/mongodb.ts`, and `lib/quiz/normalize.ts`.
- `npm test`: passed, including all chained unit/integration suites and the skeleton suite.
- `npm run build`: passed. The app remains server-rendered for dynamic authenticated routes.
- `git diff --check`: passed; Git reports expected LF-to-CRLF normalization notices for touched text files.

#### Route coverage limits

The deterministic production stream gate verifies seven top-level routes. A separate client-side App Router transition now also verifies Subject Detail with a held RSC response and paired geometry. Subject Folder, Topic Folder, Topic Detail, Review Setup, and Quiz Session route-level fallbacks still lack paired genuine-pending screenshots/geometry in this Phase 4 harness. Direct-document experiments for nested routes exposed the parent Subjects/Review loading region while nested fallback data was present in the serialized stream, so those cases were not counted as destination-specific skeleton verification. Loaded nested routes and quiz resume/session behavior remain covered by the Phase 3 responsive and quiz suites. Empty/error transitions and cross-account navigation were not exercised in this Phase 4 harness.

**Phase 4 status: PARTIAL.** Production App Router route loading is verified for all seven main pages, Subject Detail client navigation, and inline quiz completion. Geometry, Subjects responsive overflow, reduced motion, shimmer, quiz completion, and the broader existing regressions pass. Destination-specific pending captures for five other nested routes, plus empty/error and cross-account transitions, remain outstanding; this report does not claim all four phases are fully validated.
