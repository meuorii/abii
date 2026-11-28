# Abii V2 learner implementation roadmap

Preferred workflow for all phases: GPT 6 Luna, Medium reasoning. Workload labels are relative estimates, not time or token guarantees.

| Phase | Implementation | Workload | Status | References |
|---|---|---|---|---|
| 01 | Global Design System Foundation | Medium–High | Complete | `01-design-system/` |
| 02 | Application Shell, Dashboard & Unified Modals | Medium–High | Partially Complete | `02-dashboard/`, `09-shared-modals/` |
| 03 | Complete My Subjects Ecosystem | High | Not Started | `03-subjects/`, relevant shared modals |
| 04 | Complete Review & Quiz Ecosystem | High | Not Started | `04-review/`, relevant shared modals |
| 05 | Progress & Badges | Medium–High | Not Started | `05-progress/`, `06-badges/` |
| 06 | Settings & Profile | Medium–High | Not Started | `07-settings/`, `07-profile/` |
| 07 | Notification Center & Shared Feedback | Medium | Not Started | `08-notifications/` |
| 08 | Global Refinement & Regression Validation | Medium–High | Not Started | Entire finalized set, inspected selectively |

Reference paths are relative to `docs/wireframes/learner-v2/`.

Status values: Not Started, In Progress, Complete, Partially Complete, Blocked. Phase 01 is Complete after the final responsive matrix, focused Admin isolation check, synthetic learner E2E suite, build, and evidence review. The separate legacy Admin Overview pixel test remains limited by its empty chart fixture; see the implementation log. Later phases remain Not Started; this roadmap does not represent the V2 redesign as complete.

## Phase 01 refinement status (2026-11-28)

Final global learner hero refinement is implemented and validated. Phase 01 is Complete: learner hero geometry, the full Phase 01 browser suite, the authenticated responsive matrix, quiz and skeleton checks, the dedicated Admin Settings isolation check, production build, and visual evidence review have passed. A later Admin test retry timed out in its security-evidence pagination flow before reaching Settings; see the implementation log. Phase 02 implementation is underway; Phase 03 remains Not Started.

## Phase 02 completion status (2026-11-28)

Phase 02 is Complete. Dashboard V2, four independent statistics, responsive activity/subject/badge panels, honest empty/failure behavior, matching skeleton, and learner-only unified modal layout are implemented and validated. Phase 03 remains Not Started. See the implementation log for checks and evidence.
