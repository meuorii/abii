# Abii V2 learner implementation guidance

## Design references

Before learner interface work, read `docs/design-system.md`, `docs/wireframes/learner-v2/README.md`, and `docs/wireframes/learner-v2/manifest.json`. Inspect only the relevant SVGs for the current phase. Treat approved wireframes as authoritative subject to the latest user requirements. Change application source, not references as a substitute for implementation.

## Implementation rules

- Follow the approved 60–30–10 learner design direction and brand-based action styling, including destructive confirmations.
- Preserve existing animation behavior, backend contracts, functionality, and security safeguards.
- Preserve official mascot and badge assets, responsive layout, skeleton parity, accessibility, and scroll ownership.
- Keep learner, Admin, and public interface styling isolated.
- Use Tailwind CSS v4 semantic utilities for ordinary authenticated learner component presentation. Keep layout, spacing, typography, color, responsive states, and interaction states in complete static TSX class strings; avoid component CSS selectors, style modules, `@apply`, and static inline styles. Use runtime inline values only for geometry or values derived from application data.
- Keep `app/globals.css` limited to centralized tokens and theme mappings, base behavior, protected motion/reduced-motion rules, and justified technical exceptions. Preserve the learner theme boundaries and do not globally remap legacy aliases to conceal incorrect component usage.
- Learner wordmarks, active navigation labels/icons, and avatar fallback initials use `text-primary` (`#F8769C`); active navigation backgrounds use `bg-secondary-surface`. Inactive navigation uses `text-muted`.
- All authenticated learner hero sections must use a solid #FFE8EF background and contain only informational text and the official Abii mascot. Action buttons, decorative header icons, icon containers, gradients, decorative shapes, and graphical progress widgets must remain outside the hero.
- Standard learner hero dimensions are 180px mobile, 240px tablet, and 280px desktop minimum height, with 16/20px radius and 16/24/32px padding. Use the shared hero component and allow content to expand when needed.
- Keep learner hero headings identical across routes: Onest 40/32/24px desktop/tablet/mobile, weight 700, line-height 1.15/1.15/1.2, and tracking -0.03em/-0.025em/-0.02em. Eyebrows are 14/14/12px at weight 500; descriptions are 16/14/13px at weight 400 and line-height 1.5. Size official mascot artwork by visible alpha bounds, anchored bottom-right with 12/24/32px inset; constrain its width to avoid copy overlap.
- Reuse the root Playwright Test configuration for every subsequent V2 phase. Add targeted E2E regressions for changed learner routes and shared components, and keep verified browser screenshots for meaningful visual changes.
- Run Playwright against the isolated synthetic fixtures in `tests/e2e/fixtures/`. Do not reuse an arbitrary development server, `.env.local` database credentials, or real learner/Admin accounts.
- Observe real animation and reduced-motion behavior in browser checks. Do not disable animations or alter protected motion definitions to make assertions pass.
- Do not deploy without explicit approval, run destructive tests against real user data, or modify approved references without explicit authorization.
