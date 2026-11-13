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

- **Dashboard:** implemented the visible hierarchy in source-verified order: hero, Overall Mastery, Due Review and Study Streak, representative Subjects, Featured Badges, and Quick Actions. The independent Featured Badges Suspense fallback shares its composition with the route fallback.
- **Subjects:** implemented hero, representative control/search region, and cards using the loaded grid breakpoints. Route loading cannot know whether the user's preferred view or folder contents will select grid, list, or empty state; resolved page state remains authoritative.
- **Review:** implemented hero, four summary cards, Recent Subjects, representative topic rows, and the Review Progress chart/progress panel. Empty and error states remain in the resolved page.
- **Progress:** implemented five summary slots, Featured Badges, activity chart with controls/plot/stats, subject and topic performance, practice needs, and recent sessions in the loaded order. Chart marks are neutral placeholders, not simulated data.
- **Badges:** corrected the shared hero size, four fixed statistic cards (one column below 380px, two from 380px, four at `xl`), collection progress, rarity overview, filters, and representative collection cards. The loaded collection's empty/error/filter behavior is unchanged.
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
- Counts in route-level skeletons are representative. No loading-only data fetch was added. Profile identity, counts, progress, and settings remain unknown until the real page data resolves.
- No new client boundary, animation dependency, or intentional loading delay was introduced.
- Nested routes and quiz workflows remain assigned to Phase 3; final loading-to-content geometry, transitions, and cross-page browser QA remain assigned to Phase 4.
