# Abii database models

These Mongoose models are server-only and use `timestamps: true` (`createdAt` and `updatedAt`). They reuse `mongoose.models.*` before compiling a model, which prevents `OverwriteModelError` during Next.js development hot reloads.

- `User.ts` — trimmed name, lowercase/trimmed email, password hash excluded from normal query results, unique email index.
- `Subject.ts` — subject owner and name; owner index.
- `Flashcard.ts` — owner, subject, question, answer, optional hint, and type; compound owner/subject index.
- `ReviewRecord.ts` — owner, flashcard, correct/wrong result, question type, review dates; owner/card/next-review index.
- `index.ts` — convenient server-side exports.

Import models from server components, route handlers, or server actions only. Do not import them from files marked `"use client"`. The `server-only` guard helps Next.js catch accidental client imports.

MongoDB indexes are declared in the schemas. Mongoose normally creates declared indexes when a model initializes; for production deployments, consider running index creation as a controlled deployment step rather than relying on automatic index creation.
