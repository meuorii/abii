# Abii Design System v1.1 — Official Visual Standards

This document is the implementation reference for Abii’s visual language. The `/design-system` route is the working component showcase. The Phase 01 learner palette is scoped to the authenticated learner workspace; Admin keeps its own theme and public pages remain outside that learner scope.

## 1. Design intent

Abii should feel soft, minimal, modern, premium, and aligned with its friendly otter mascot. The interface supports learning without competing with it: warm neutral page backgrounds, white content surfaces, pale blush support surfaces, and a restrained pink accent.

Use the 60–30–10 balance as a visual guideline. It describes relative visual weight, not a requirement that every component use all three colors. Keep semantic colors for actual status feedback. Avoid decorative gradients, unrelated colors, and effects that do not help hierarchy or interaction.

## 2. Official color tokens

### Brand and surfaces

| Token | Value | Intended use |
| --- | --- | --- |
| `--background` | `#FFF9FC` | Main page background (about 60%) |
| `--dashboard-frame` | `#FFF4F8` | Supporting structural color for the outer admin dashboard canvas; not an additional brand accent |
| `--secondary-surface` | `#FFE8EF` | Hero and supporting blush surfaces (about 30%) |
| `--primary` | `#F8769C` | Primary CTA and brand accent (about 10%) |
| `--surface` | `#FFFFFF` | Cards, fields, and dialog surfaces |
| `--border` | `#E8DDE1` | Borders and dividers |
| `--surface-hover` | `#FFF1F5` | Subtle hover surface |
| `--surface-selected` | `#FFE8EF` | Selected navigation and active surfaces |

### Text

| Token | Value | Intended use |
| --- | --- | --- |
| `--foreground` | `#30262B` | Primary text and headings |
| `--muted` | `#6F5964` | Supporting text and descriptions |
| `--primary-foreground` | `#FFFFFF` | Text on the filled brand button, per approved styling |

### Primary action states

| Token | Value |
| --- | --- |
| `--primary` | `#F8769C` |
| `--primary-hover` | `#EC658D` |
| `--primary-active` | `#D9547D` |

### Semantic statuses

| Status | Base | Background | Text |
| --- | --- | --- | --- |
| Success | `#5C947A` | `#EDF5EF` | `#3D7259` |
| Warning | `#B28A54` | `#FBF3E7` | `#8A683B` |
| Error | `#B42347` | `#FCEDEF` | `#8A1F36` |

Semantic color should always be paired with a clear label, icon, or explanatory message. Do not use these colors for decoration.

## 3. Typography

- Use **Onest** as the interface typeface, already configured as the project’s `font-sans`.
- Use the configured brand display face only where the existing wordmark calls for it; do not use it for long passages.
- Use clear hierarchy: bold, compact headings; regular body copy with comfortable line height; small uppercase labels only for short section markers.
- Prefer `--foreground` for headings and key labels, and `--muted` for supporting content.
- Do not reduce body copy to tiny sizes to fit a layout. Reflow content at narrow widths.

## 4. Layout and surfaces

- Keep page backgrounds warm and quiet (`#FFF9FC`). Standard hero sections use `#FFE8EF`.
- Use `--dashboard-frame` (`#FFF4F8`) only for the outer canvas surrounding the admin dashboard frame. Keep the inner workspace on `--background`; this supporting structural neutral is separate from the 60–30–10 brand balance.
- Use white cards with subtle `#E8DDE1` borders. Shadows should stay faint and support elevation rather than decoration.
- Use blush surfaces for selected navigation, small callouts, and secondary panels; leave generous whitespace between major groups.
- Preserve a readable content width and adapt columns to available space. At narrow viewports, stack side-by-side content and keep controls usable without horizontal scrolling.
- Use the existing rounded component language consistently. Avoid adding unnecessary nested borders or cards inside cards.

## 5. Buttons and interaction states

- Use the shared `Button` component and its `primary`, `secondary`, `outline`, `ghost`, and `danger` variants for standard actions; do not duplicate action-button classes in individual screens. Use `buttonClassNames` for links that need button styling while preserving link semantics.
- Primary CTA: `#F8769C`, white foreground, `#EC658D` on hover, and `#D9547D` while pressed.
- Secondary: `#FFE8EF` surface and `#F8769C` text/icons; hover uses `#FFF1F5` with `#EC658D` text; pressed uses `#FFE8EF` with `#D9547D` text.
- Outline: white surface, `#E8DDE1` border, and `#F8769C` text/icons; hover uses `#FFF1F5`, pink border, and `#EC658D` text; pressed uses `#FFE8EF` and `#D9547D` text.
- Ghost: transparent at rest with `#F8769C` text/icons; hover uses `#FFF1F5` with `#EC658D` text; pressed uses `#FFE8EF` with `#D9547D` text.
- Destructive actions keep semantic intent in code but use brand outline/ghost styling at entry points and brand primary styling for explicit confirmations. Semantic error colors are reserved for actual error feedback.
- Checkboxes use a white unchecked surface with a neutral border. Checked state uses a solid `#F8769C` fill and a white checkmark. Keep hover border, visible focus ring, and a distinct disabled state.
- Disabled controls should be visibly inactive and should not respond to pointer input. All interactive controls need a visible keyboard focus state, useful hit area, and clear accessible name.

### Contrast limitation

White text on `#F8769C` and `#F8769C` text on white or pale blush surfaces are approved visual treatments, but do **not** meet WCAG AA contrast for normal-sized text. This is a known limitation in the finalized palette, not a claim of compliance. Keep the chosen palette as approved, avoid extending it to long copy, and retain visible focus rings and clear labels/icons. Do not silently substitute another brand color.

## 6. Forms and validation

- Fields use a white surface, neutral border, primary text, and muted placeholder/supporting text.
- Focus changes the border and adds a visible ring using the brand interaction color.
- Disabled fields are clearly inactive.
- Validation errors use `--error-bg` and `--error-text`, plus `aria-invalid` and a programmatic description where appropriate. Do not communicate errors by border color alone.
- Associate every visible label with its control. Keep helper and error copy close to the field it explains.

## 7. Navigation, cards, and progress

- Selected navigation uses `--surface-selected` with a readable text treatment; hover uses `--surface-hover`.
- Cards use `--surface`, `--border`, and primary/secondary text tokens. Keep card actions easy to distinguish.
- Progress uses the primary brand color on a pale blush track and exposes a meaningful accessible label and current value.
- Focused learning content should remain the strongest element in a study flow.

## 8. Feedback and dialogs

- Loading communicates status to assistive technology and should not block more content than necessary.
- Empty states explain what is absent and, when useful, provide a next action. The mascot can add personality without replacing the message.
- Errors should state what happened and offer a recovery path when one exists.
- Toasts use semantic status palettes, a status label/icon, and readable message text. They pause when users interact with them and provide a dismiss control.
- Dialogs use a blush header, white content surface, clear title and description, visible focus, keyboard dismissal when safe, and a deliberate action hierarchy. Destructive confirmations use brand primary styling while retaining their alert semantics and safeguards.

## 9. Mascot and imagery

- Use the existing Abii mascot assets for the established states: welcome, correct, wrong, review reminder, complete, and empty.
- Keep mascot art supportive and secondary to the task. Do not recolor or replace approved original artwork to simulate semantic feedback.
- Provide useful alternative text when the image conveys meaning. Decorative art should use empty alternative text.

## 10. Motion and accessibility

- Keep animation short and purposeful. Honor `prefers-reduced-motion`; decorative motion should stop or simplify for users who request reduced motion.
- Do not rely on color alone for success, warning, error, selection, or progress.
- Preserve keyboard navigation and visible focus. Dialogs must manage focus and return it when closed.
- Maintain semantic HTML, accessible names, readable text, and appropriate status announcements.
- Recheck contrast when changing any token pairing. The primary-button white-text limitation above is the documented exception.

## 11. CSS and Tailwind implementation

The base tokens are defined in `app/globals.css` and exposed as Tailwind v4 color utilities. Authenticated learner routes use `.learner-theme` and learner modal portals use a matching scoped theme so Admin and public pages keep their current styling. Prefer semantic utilities in components rather than raw hex values:

```tsx
import { Button, buttonClassNames } from "@/components/ui/button";

<main className="min-h-screen bg-background text-foreground">
  <div className="bg-dashboard-frame p-4">
    <div className="bg-background">
      <section className="rounded-2xl bg-secondary-surface">
        <div className="rounded-xl border border-border bg-surface p-5">
          <Button>Continue</Button>
          <Button variant="secondary">Secondary action</Button>
          <Button variant="outline">Cancel</Button>
          <Button variant="ghost">View details</Button>
        </div>
      </section>
    </div>
  </div>
</main>
```

For a navigational action that must remain an anchor, keep the link and share the button variant styles:

```tsx
<Link href="/admin/users" className={buttonClassNames({ variant: "outline" })}>View users</Link>
```

For status feedback, use the matching background and text tokens, and include an icon or label:

```tsx
<p className="rounded-xl bg-success-bg p-3 text-success-text">Saved successfully</p>
<p className="rounded-xl bg-warning-bg p-3 text-warning-text">Review this item</p>
<p className="rounded-xl bg-error-bg p-3 text-error-text">Could not save</p>
```

Legacy aliases (`--pink-soft`, `--pink-card`, `--pink`, `--pink-accent`, `--pink-primary`, and `--pink-active`) remain temporarily available because existing screens still consume them. New or touched UI should use the semantic tokens above; migrate aliases only as part of a deliberate screen update.

## 12. Admin Data Visualization Color Standards

Admin charts use one pink visualization family. These colors identify datasets; they do not communicate success, warning, or failure:

| Chart role | Value | Use |
| --- | --- | --- |
| Primary series | `#F8769C` | First or primary dataset; solid line |
| Secondary series | `#EC658D` | Second dataset; dashed line or patterned bars |
| Tertiary series | `#D9547D` | Third dataset; dotted line or differently patterned bars |
| Area fill | `#FFE8EF` | Line-chart area and donut remainder |
| Soft highlight | `#FFF1F5` | Patterned bar base |
| Chart labels | `#6F5964` | Axes and legends |
| Tooltip values | `#30262B` | Important values and tooltip text |
| Grid lines | `#E8DDE1` | Chart guides and separators |
| Chart surface | `#FFFFFF` | Tooltip and chart surface |

Keep series distinguishable with solid, dashed, and dotted line styles, line widths, and bar patterns alongside clear legends and tooltips. For more than three datasets, reuse the pink shades with additional patterns or markers; do not add new hues or make datasets visually identical. Donut charts use primary pink for the measured portion and pale blush for the remainder. Retention matrices use a pink intensity scale. Chart colors never replace explicit event labels or descriptions, and semantic status badges, alerts, and form feedback retain their success, warning, and error colors. Keep accessible chart names and keyboard inspection, and do not rely on color alone to convey meaning.

## 13. Rollout scope and admin theme

The v1.1 palette refinement changes the shared main background to `#FFF9FC` and adds `#FFF4F8` as the admin dashboard's outer frame canvas. The frame color is a supporting structural neutral, not an extra brand accent. The admin shell keeps the workspace, content wrapper, sidebar, and header on the main background; hero sections remain `#FFE8EF`, cards remain white, and dialogs keep white content surfaces. All eight dashboard routes inherit these shared shell values.

The admin dashboard uses `.admin-shell` scoped values that match Design System v1.1, while the global `--background` updates screens that already consume the shared token. Dialogs opened from inside the admin inherit the matching background token through the portal and retain white modal content. This color refinement does not change page layouts, chart data or calculations, APIs, business logic, authentication, or database behavior. When migrating another screen, replace local hard-coded colors with semantic tokens and check its behavior in that screen’s own theme.

## 14. Reference page

Visit `/design-system` to inspect the final palette, typography, button states, cards, form validation, semantic feedback, mascot states, flashcards, progress, loading and empty states, toasts, and dialogs. Interactive examples are functional and safe to explore; they do not submit data.

## 15. Abii V2 learner foundation (Phase 01)

- Follow the approved 60–30–10 hierarchy: main workspace `#FFF9FC`, blush support and hero `#FFE8EF`, and brand accent `#F8769C`. The outer learner frame is `#FFF4F8`; cards are white with `#E8DDE1` borders.
- Learner headings and body use `#30262B`; secondary copy uses `#6F5964`. Keep the existing Onest typeface. Every learner hero variant shares one heading scale: 40px desktop, 32px tablet, 24px mobile; weight 700; line-height 1.15/1.15/1.2; letter-spacing -0.03em/-0.025em/-0.02em. Eyebrows are 14px desktop/tablet and 12px mobile at weight 500. Descriptions are 16px desktop, 14px tablet, and 13px mobile at weight 400 and line-height 1.5. Brand emphasis inherits the same heading scale. All learner hero variants use `#FFE8EF` with `#E8DDE1` borders. Admin and public scopes retain separate typography.
- All authenticated learner hero sections must use a solid #FFE8EF background and contain only informational text and the official Abii mascot. Action buttons, decorative header icons, icon containers, gradients, decorative shapes, and graphical progress widgets must remain outside the hero.
- The shared learner hero minimum heights are 180px mobile, 240px tablet, and 280px desktop. Radius is 16px mobile and 20px above; content padding is 16px mobile, 24px tablet, and 32px desktop. Text and mascot use a shared 60/40 layout; the official mascot is bottom-right with 12/24/32px right inset and is sized from its visible alpha bounds so transparent PNG margins do not shrink the artwork. Target visible mascot height is about 85–90% on mobile and 88–90% above; width is constrained to prevent overlap. Longer content expands the hero naturally rather than clipping.
- Learner typography tokens live in `.learner-theme` in `app/globals.css`: eyebrow 14px / 12px at weight 600; descriptions 16px / 14px at weight 400; section headings 20px / 18px at weight 600; card headings 16px at weight 600; statistics 28px / 24px at weight 700; body and button labels 14px; form labels 14px at weight 500; helper text 12px. Use unitless line heights and allow content to wrap.
- Primary buttons use `#F8769C` with white text, `#EC658D` hover, and `#D9547D` pressed. Secondary, outline, and ghost variants use approved blush and neutral surfaces. Disabled actions remain visibly inactive.
- All learner destructive entry points use brand outline or ghost appearances. Explicit delete, remove, clear, and discard confirmations use brand primary styling. Preserve danger intent internally and retain existing confirmation text, typed confirmation, focus, pending guards, server validation, authorization, transactions, and errors. Admin consumers retain their existing appearance.
- Success uses `#5C947A` / `#EDF5EF` / `#3D7259`; warning uses `#B28A54` / `#FBF3E7` / `#8A6B3B`; error uses `#B42347` / `#FCEDEF` / `#8A1F36`. Preserve official badge artwork and rarity treatment.
- Analytical charts use `#F8769C`, `#EC658D`, and `#D9547D`, with `#FFE8EF` fills, `#6F5964` labels, and `#E8DDE1` guides. Keep series distinguishable by labels, patterns, and line styles.
- Keep existing animation definitions, wrappers, triggers, timings, easing, stagger, and reduced-motion behavior unchanged. Preserve page geometry, skeleton parity, and scroll ownership until the relevant phase.
- Avatar fallback uses the user's initial on an approved blush surface with brand accents; preserve uploaded profile images and their crop behavior.
- For future learner layout work, use a 12-column desktop grid and a 4-column mobile grid, 24px desktop / 16px mobile page insets, and 16px / 12px gaps. Let content wrap naturally, avoid fixed-height clipping, preserve the established scroll owner, and maintain usable touch targets.
- White text on `#F8769C` is explicitly approved, but does not meet WCAG AA for normal-sized text. Do not claim conformance or silently substitute another brand color.
- Dashboard V2 uses a 12-column desktop workspace grid and four-column mobile grid, with four independent statistic cards followed by Today’s Review / Weekly Activity and My Subjects / Featured Badges. Dashboard mastery and counts reuse the established mastery service; subject total uses the complete owned-subject collection.
- Learner dialogs retain the shared `Modal` API and action variants. Their scrollable content uses a responsive 12-column desktop / four-column mobile grid with 16px / 12px gaps; learner-only footer actions use equal columns or one full-width column. The Admin modal appearance remains isolated.
- Approved learner references are under `docs/wireframes/learner-v2/`. Inspect only the SVGs for the current phase; never modify the approved reference package without explicit authorization.
- Use the root Playwright Test suite for learner browser regression: `npm run test:e2e:phase1`. It owns a loopback-only memory database and synthetic fixtures. The completed validation matrix and screenshot paths are indexed in `docs/ABII_V2_IMPLEMENTATION_LOG.md`.
# Learner implementation styling policy

Authenticated learner components use Tailwind v4 semantic utilities for ordinary presentation. Use `bg-primary`, `text-primary`, `text-foreground`, `text-muted`, `bg-background`, `bg-surface`, `bg-secondary-surface`, and `border-border` rather than literal palette values or legacy pink aliases. Default accents and active navigation resolve to `#F8769C`; pressed actions resolve to `#D9547D` only in the pressed state.

Keep learner component layout and responsive behavior in complete static class strings in TSX. The shared global stylesheet holds theme tokens and mappings, base behavior, protected animation/reduced-motion rules, and narrow technical exceptions such as native range control pseudo-elements. Runtime style values are permitted for data-driven dimensions and measured mascot crops. Learner changes in shared components must remain scoped so Admin and public consumers keep their own theme.
