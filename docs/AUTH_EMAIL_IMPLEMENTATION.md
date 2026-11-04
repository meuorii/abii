# Abii email verification and password recovery

## Environment

Set `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (a sender verified in Brevo), `BREVO_SENDER_NAME`, `AUTH_OTP_SECRET`, `AUTH_SECRET`, and `APP_BASE_URL`. Keep `AUTH_SECRET` stable and use a different random value for `AUTH_OTP_SECRET`; both must contain at least 32 characters. `APP_BASE_URL` is the app origin. `EMAIL_ASSET_BASE_URL` is the optional public HTTPS origin serving `/email/verification-mascot.png` and `/email/password-reset-mascot.png`. Do not configure localhost as the email asset origin.

If the deployment proxy supplies an IP header that it overwrites, set `TRUSTED_PROXY_IP_HEADER` to `x-real-ip` or `cf-connecting-ip`. The server ignores proxy IP headers unless explicitly configured. Never commit `.env.local`.

## Authentication flows

- Registration creates an unverified account and sends a code. It does not create a normal session. Failed delivery leaves the new account recoverable through password login and code resend.
- An unverified account with a correct password receives a short-lived signed, HttpOnly pending-verification cookie. It cannot access protected pages or APIs.
- A valid old signed session for an unverified account is redirected to `/verify-email`; the old cookie only identifies the account and never authorizes private data. Expired/tampered sessions require login.
- Verification consumes an email-verification challenge once, marks the same user document verified, and creates the regular 30-day session. Verified sessions continue directly to the dashboard.
- Password recovery uses the independent `password_reset` purpose, generic request response, and a five-minute signed HttpOnly reset authorization. Completing reset increments `sessionVersion`; existing sessions stop authorizing. The user signs in again.

## Database and legacy data

`User.emailVerifiedAt` missing or null means unverified. `sessionVersion` missing is treated as version zero. Existing verification dates are preserved. The rollout needs no account or learning-data migration: schema defaults and authorization checks safely interpret legacy fields without writing user documents. Do not backfill verification timestamps. This avoids touching account IDs, passwords, subjects, folders, topics, flashcards, quizzes, reviews, mastery, or badges. `AuthChallenge` stores only an HMAC of the OTP and uses a TTL cleanup index; `AuthRateLimit` stores hashed fixed-window keys; `PasswordResetGrant` stores only a hash and expires by TTL. Explicit expiration checks remain in the request path because TTL cleanup is asynchronous.

Production rollout should back up MongoDB and review index creation before enabling email verification. No production migration is run automatically.

## Email templates

`lib/email/templates.ts` renders HTML and a readable plain-text representation from the Abii design reference, with a pink hero, original mascot assets, six text-based OTP boxes, escaped names, and light-mode fallback colors. The current Brevo static-content endpoint documents `htmlContent`, `textContent`, and `templateId` as alternative body modes, so this integration sends `htmlContent` only; the generated text representation is not submitted. Dark mode is progressive enhancement via color-scheme metadata and `prefers-color-scheme`; support varies by Gmail, Apple Mail, Outlook, and automatic client inversion. The template was unit-tested and the reference image was inspected. Real inbox rendering has not been verified in client applications.

## API routes

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/auth/verify-email/pending`, `POST /api/auth/verify-email`, `POST /api/auth/verify-email/resend`
- `POST /api/auth/forgot-password`, `/verify`, `/resend`, and `/reset`
- `PATCH /api/account/password` changes a signed-in user's password and revokes prior sessions.

State-changing auth requests validate the request origin when supplied and use HttpOnly, secure-in-production, SameSite strict cookies. Rate limits are MongoDB-backed by normalized identity; optional IP limits only use a proxy header when explicitly trusted by configuration.

## Tests and production readiness

`npm run test:auth-email` runs template, OTP primitive, and mocked Brevo tests. `npm test` includes it with the existing project suites. The repository does not yet have route-level MongoDB integration tests for registration, verification, recovery, concurrency, or learning-data preservation. Configure an isolated test MongoDB before adding/running those suites; never point tests at production. Live Brevo delivery, browser interaction at target viewport sizes, and real-client email rendering still require environment credentials and manual validation.

Before production: back up MongoDB; configure a verified Brevo sender and public HTTPS asset origin; ensure indexes are present; verify registration, existing-user verification, old-session denial, persistent verified login, recovery, and session revocation with test accounts; inspect inbox rendering; and review rollback procedures. Do not automatically run a migration or deploy from this repository task.
