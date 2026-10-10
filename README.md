# Abii

Abii is an Active Recall Learning Web App.

**Tagline:** Learn a little, remember a lot.

## Requirements

- Node.js 20.9 or newer
- npm
- MongoDB running locally or a MongoDB Atlas connection string

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```powershell
   Copy-Item .env.local.example .env.local
   ```

   (On macOS/Linux, use `cp .env.local.example .env.local`.)

3. Edit `.env.local` and set `MONGODB_URI` and `AUTH_SECRET`. The default MongoDB URI is suitable only when MongoDB is installed and running on your computer. Never commit `.env.local`, prefix database secrets with `NEXT_PUBLIC_`, or read them in client components.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000/design-system for the design-system demo.

## Checking the database connection locally

The app does not connect to MongoDB just by opening a page yet; database features and pages are intentionally not part of this phase. To verify the connection, create a temporary file named `scripts/check-db.ts` and run it with a TypeScript runner if you have one installed, or use the simple JavaScript check below after dependencies are installed.

Create `scripts/check-db.mjs`:

```js
import mongoose from "mongoose";
import "dotenv/config";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is missing from .env.local");

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.db.admin().ping();
  console.log("MongoDB connection successful.");
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
```

Install `dotenv` for this optional script with `npm install -D dotenv`, then run:

```bash
node --env-file=.env.local scripts/check-db.mjs
```

Alternatively, once a server-side feature calls `connectToDatabase()`, that helper can be checked with `await connectToDatabase()` and `await mongoose.connection.db.admin().ping()` in server-side code. Do not add database credentials to client-side code.

## Available checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Folder structure

- `app/` — App Router pages, layout, styles, and design-system demo
- `components/ui/` — reusable UI components
- `lib/mongodb.ts` — server-only MongoDB connection helper with a shared promise/connection cache
- `models/` — server-only Mongoose models
- `actions/` — reserved for future server actions

## Scope

This phase adds only the database connection helper and data models. It does not implement pages, registration, login, authorization, or study workflows. Future database operations must verify that the authenticated user owns each subject, flashcard, and review record; schema references alone do not enforce ownership.

## Authentication (Phase 5)

Authentication uses a small custom implementation with **`jose`** for signed sessions and **`bcryptjs`** for password hashing. The session is a seven-day, signed JWT stored in an `HttpOnly`, `SameSite=Strict` cookie; the cookie is `Secure` in production. `AUTH_SECRET` must be a random secret at least 32 characters long. Keep it only in `.env.local` / deployment environment variables.

1. Install dependencies with `npm install`.
2. Copy `.env.local.example` to `.env.local`, set `MONGODB_URI`, and replace `AUTH_SECRET` with a random 32+ character secret (for example, `openssl rand -base64 32`).
3. Start MongoDB locally or use a MongoDB Atlas URI.
4. Run `npm run dev` and visit `/register`, then `/login` and `/dashboard`.

Registration is `POST /api/auth/register`; login is `POST /api/auth/login`; logout is `POST /api/auth/logout`. Server code should use `getCurrentUser()` from `lib/auth/session.ts` to resolve the user from the trusted session. Do not accept a user ID from form data as proof of identity. For every private data query or mutation, filter by the authenticated user's ID as well as the requested document ID.

The middleware protects `/dashboard`, `/subjects`, `/review`, and `/settings` route trees. Add any future private route prefix to `middleware.ts`. The dashboard is a small protected placeholder for this phase; study features are not included.

### Manual authentication checks

- **Registration:** create an account with a valid name, email, and password of 8–128 characters; it should redirect to the dashboard.
- **Email normalization:** register with mixed-case or surrounding spaces in the email, then try signing in with the normalized email.
- **Duplicate registration:** repeat registration with the same email; it should show a friendly generic message, not expose account data.
- **Validation:** try a malformed email, blank name, and password shorter than 8 characters; each should be rejected.
- **Login:** valid credentials should open `/dashboard`; wrong email or password should show the same generic credential error.
- **Logout:** select **Log out**, then manually visit `/dashboard`; it should redirect to `/login`.
- **Unauthenticated access:** in a private/incognito browser window, visit `/dashboard`, `/subjects`, `/review`, or `/settings`; each should redirect to `/login`.

No test suite or live MongoDB connection was available to execute here. Run `npm install`, `npm run typecheck`, `npm run lint`, and `npm run build` locally to complete verification. The authentication routes require MongoDB to be reachable.
