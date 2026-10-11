# Abii — Phase 7: Premium Landing Page

## Files
- `app/page.tsx` — replaces the starter home page with the public landing page.
- Uses the existing palette values: white, `#FFF7F9`, `#FFE8EF`, `#FF9FBA`, `#FF6F96`, `#E9577D`, `#C65380`, `#2F2930`, `#756B72`, and `#E8E2E5`.

## Mascot asset
The hero expects the supplied existing Abii welcome image at:

`public/mascot/welcome.png`

The Phase 3 mascot component documentation uses this path. Keep the original artwork unchanged. If your actual welcome image is currently saved elsewhere, copy that exact file to `public/mascot/welcome.png` (or update the `src` in `app/page.tsx` to match its current public path). The image is rendered with `object-contain` so it will not be stretched or cropped.

## Routes
- Primary Get Started buttons link to `/register`.
- Log in buttons link to `/login`.

These match the authentication paths used by the existing Abii auth layout and should be checked against your local route files.

## Apply
Merge the included `app/page.tsx` into the root of your existing Next.js project. No dependencies, database changes, or authentication changes are included.

## Verify
Run:
```bash
npm run lint
npm run typecheck
npm run build
npm run dev
```
Then visit `/` and test both links. Check desktop, tablet, and mobile widths and confirm the image at `/mascot/welcome.png` loads.

I have not run the checks against your local project or verified the browser layout, because the full current project and actual local mascot assets were not available in this working folder. This package contains only the landing page file and instructions.
