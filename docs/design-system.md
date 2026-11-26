# Abii Design System v1.1 — Official Visual Standards

This document is the implementation reference for Abii’s visual language. The `/design-system` route is the working component showcase. Use this specification for future UI work across the landing page, learner application, and admin dashboard while respecting any dashboard-specific scoped theme.

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
| Error / destructive | `#C76F7D` | `#FCECEF` | `#A94D61` |

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
- Danger actions retain semantic error background and text; do not make destructive actions look like brand actions.
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
- Dialogs use a blush header, white content surface, clear title and description, visible focus, keyboard dismissal when safe, and a deliberate action hierarchy. Destructive dialogs use semantic error styling.

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

The tokens are defined in `app/globals.css` and exposed as Tailwind v4 color utilities. Prefer semantic utilities in components rather than raw hex values:

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
