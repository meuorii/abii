# Public homepage assets and previews

## Mascot images in use

- `public/landing/home/hero mascot.png` — prioritized hero artwork, shown directly on the white page.
- `public/landing/home/brand-personality-mascot.png` — lazy-loaded in the Meet Abii section.
- `public/landing/home/cta-mascot.png` — lazy-loaded in the final invitation.

The hero filename includes a space because that is the supplied on-disk name. The page uses the URL-encoded path through Next Image's `src` handling; no image rename was needed.

## Product screenshots in use

All three product screenshots are used directly in the homepage showcase; their original aspect ratios are preserved. The full supplied asset set resides under `public/landing/home/`.

## Interactive product experience

- **Organize** — `/landing/home/workspace-demo.png`.
- **Practice** — `/landing/home/quiz-demo.png`.
- **Progress** — `/landing/home/progress-demo.png`.

The images are finished product screenshots and render directly in one image stage. The three-step tablist switches among them; the screenshot can be opened in an accessible native dialog for a larger view. No React application preview is rendered in the homepage showcase. The older preview components, sample data, and grading utility are retained for reuse and existing tests.

## Planned marketing destinations

Features and About point to the corresponding homepage sections. Dedicated About, Blog, and Guides pages do not currently exist. About, Blog, and Guides are represented as planned destinations and are not linked to nonexistent routes. Suggested Guide and Blog titles are editorial concepts, not published articles.
