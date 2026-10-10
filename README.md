# Abii

Abii is an Active Recall Learning Web App.

**Tagline:** Learn a little, remember a lot.

## Requirements

- Node.js 20.9 or newer
- npm
- A MongoDB connection (local MongoDB or MongoDB Atlas) when database features are added

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.local.example .env.local
   ```

   On Windows PowerShell, use:

   ```powershell
   Copy-Item .env.local.example .env.local
   ```

3. Edit `.env.local` and set your own values for `MONGODB_URI` and `AUTH_SECRET`.
   Never commit `.env.local` or expose these values to client-side code.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000.

## Available checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Folder structure

- `app/` — App Router pages, layout, global styles, and the design-system demo
- `components/ui/` — reusable design-system components
- `lib/` — server-side utilities such as the MongoDB connection
- `models/` — Mongoose models (added in a later phase)
- `actions/` — server actions (added in a later phase)

## Design system demo

Run the development server and open http://localhost:3000/design-system to view
the palette, buttons, cards, form controls, progress bar, flashcard, navigation,
mascot placeholders, and loading/error/empty states.

## Phase 1 and Phase 2 scope

The starter includes the initial Next.js App Router setup, TypeScript, Tailwind
CSS, a branded home page, environment-variable example, a reusable MongoDB
connection helper, and reusable design-system components. Authentication and
study features are intentionally not implemented yet.


## Phase 3: Mascot artwork

The reusable `Mascot` component is in `components/ui/mascot.tsx`. Put your existing Abii images in `public/mascot/` using the exact filenames in `public/mascot/README.md`: `welcome.png`, `correct.png`, `wrong.png`, `review-reminder.png`, `complete.png`, and `empty.png`. For example, the welcome image is stored at `public/mascot/welcome.png` and is used in code as `/mascot/welcome.png`.

The screenshot of your Downloads folder shows the six image names, but the actual image files were not included as individual project assets in the upload. Until you copy them into `public/mascot/`, the component displays a neutral fallback. The demo at `/design-system` shows all six states.
