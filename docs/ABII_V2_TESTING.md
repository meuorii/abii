# Abii V2 browser testing

Run `npm run test:style-compliance` for the reusable learner source styling check. It reports file and line for hardcoded utility colors, legacy aliases, static inline presentation, learner CSS Modules, and prohibited global component selectors; it also verifies detection with an invalid synthetic snippet.

## Phase 01 Playwright Test

The reusable Chromium runner uses `@playwright/test` and the existing `playwright` browser library, both pinned to 1.65.0. Install the dependency with `npm install`; install Chromium with `npx playwright install chromium`.

| Command | Purpose |
| --- | --- |
| `npm run test:e2e` | Run every test in `tests/e2e/`. |
| `npm run test:e2e:phase1` | Run tests tagged `@phase1`. |
| `npm run test:e2e:ui` | Open Playwright UI mode. |
| `npm run test:e2e:headed` | Run Chromium with a visible browser. |
| `npm run test:e2e:report` | Open the last HTML report. |

Configuration is in `playwright.config.ts`: one Chromium worker, zero retries, headless by default, explicit timeouts, screenshots on failure, and trace/video retention on failure. The owned test server does not reuse a running development server.

## Fixture isolation

`tests/e2e/fixtures/server.mjs` starts a loopback-bound `MongoMemoryServer`, asserts its host and dedicated database name before seeding synthetic learner and study data, signs a short-lived test-only learner session, and launches its own Next.js process. `playwright.config.ts` and the server share `ABII_PLAYWRIGHT_PORT` (default `4174`) for the browser base URL and readiness check. Check the requested loopback port before starting Playwright; set `ABII_PLAYWRIGHT_PORT` to an available alternative if needed. The test server overrides the database URI, authentication secret, Admin UI flag, email provider keys, Cloudinary keys, scheduler secrets, and delivery settings. Admin routes stay disabled in this fixture. The cookie and fixture IDs are written under ignored `.playwright/fixture.json` and regenerated on every run.

For example, to use a free alternative port in PowerShell: `$env:ABII_PLAYWRIGHT_PORT = '4175'; npx playwright test tests/e2e/design-system.spec.ts; Remove-Item Env:ABII_PLAYWRIGHT_PORT`.

The browser tests never connect to `.env.local` databases, use real learner or Admin accounts, send notification/email deliveries, or reuse an arbitrary server. Do not add authentication bypasses to application code. Use the existing isolated Admin browser suite for Admin session, route, and theme checks.

## Phase coverage

Each V2 phase should add focused E2E checks for changed routes and shared components, actual computed styles when visual tokens change, responsive behavior at relevant breakpoints, accessible names and interactions, theme isolation, and any affected animation or modal behavior. Keep the independent route/viewport cases separately reportable. Observe normal motion and reduced motion separately. Never turn off animations or change the protected `components/motion/` implementation to satisfy an assertion.

Current Phase 01 specs cover computed learner surfaces and button states, destructive modal styling and focus restoration, hero typography roles, long subject/topic title wrapping, the Progress 768px reveal, normal/reduced motion visibility, responsive widths from 320px through 2560px, public/auth/learner scope isolation, and the notification dropdown.

Phase 02 adds `npx playwright test tests/e2e/dashboard-v2.spec.ts` for populated and new-learner Dashboard states, 320/390/768/1024/1440/1920px overflow and layout checks, review route intent, and representative learner modal footer, pink confirmation, and Escape behavior. The existing memory fixture seeds a separate empty learner for genuine zero-data coverage. Focused badge persistence, badge route, due-review, and skeleton regression results are recorded in the implementation log.

Phase 03 adds `npx playwright test tests/e2e/subjects-v2.spec.ts`. It covers all five Subjects routes at desktop and mobile sizes, independent route statistics, owner/subject scope, all four Subject Details tabs, moving a subject between unfiled and folder collections, topic discoverability through expansion/search/sorting/tab changes, zero-card topics, review destinations, Standard and Enumeration editor layouts, locked Topic Detail context, subject-level topic selection, visible modal button labels, protected deletion confirmation, and narrow/tablet toolbar overflow. Screenshots use only the isolated synthetic fixture and are saved under `docs/ABII_V2/evidence/phase03-`.

## Artifacts

- Failure screenshots, traces, videos, and HTML reports: `test-results/` and `playwright-report/` (ignored by Git).
- Stable visual evidence: `docs/ABII_V2/evidence/`.
- The implementation log contains the verified evidence index and validation results.

Keep saved screenshots synthetic and free of real user information. Capture normal animation behavior after content is ready; tests should not set `animations: "disabled"` for new visual evidence.

## Known limits

- Chromium is the only configured browser for Phase 01.
- The fixture uses a synthetic learner. Existing Admin test infrastructure runs separately because it must verify the real MFA flow against an isolated replica set.
- The focused Admin Settings check passed at 390px and 1440px. The legacy Admin Overview pixel assertion expects chart canvases although the Overview render has no canvas when chart data is empty or unavailable; seed positive synthetic chart data or assert the empty state before relying on that specific check.
- The approved white-on-`#F8769C` primary action text does not meet WCAG AA contrast for normal-sized text; do not claim conformance.

The final hero refinement adds real rendered hero surface, control/icon absence, mascot bounds, and equivalent default-height coverage at 320, 390, 768, 1024, and 1440px. Fresh refinement screenshots use the `refined-` filename prefix. The Phase 01 browser suite passed 56/56; see the implementation log for the full validation record and the latest Admin-suite pagination timeout.
