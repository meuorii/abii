# Notifications: Phase 1 backend

The notification model is an account-owned durable inbox. Trusted server code calls `createNotification` with a verified owner and event-specific input. The service validates content and compact metadata, checks the account's category preference, then inserts through a unique `{ userId, dedupeKey }` index. A duplicate returns `already_exists`; it never updates the original notification. Notification failures in future quiz, badge, and scheduler producers must be isolated from the authoritative operation, logged with owner/event context, retried or reconciled through a durable producer workflow where needed, and must never cause the source quiz or award to roll back.

`GET /api/notifications` uses owner-scoped keyset pagination on `(createdAt, _id)`, with a 20-item default and 50-item maximum. The other route handlers provide indexed unread counts, owner-scoped read transitions, bulk read, and partial preferences. APIs expose allowlisted DTO fields and private no-store responses. Creation deliberately has no public API route. Security notifications ignore preference state and are always enabled.

The `Notification` collection has three query indexes: owner/newest listing, owner/read-state count, and owner/dedupe uniqueness. `metadata` stores only validated IDs, compact event identifiers, counts, and period keys. Targets are constrained to existing internal route patterns. No TTL index is configured: retention/expiration must be defined per category before a later phase assigns `expiresAt` or adds cleanup. Security and achievement records should remain durable; temporary reminder retention needs an explicit product policy.

Preferences are embedded under `User.settings.notifications`; `dailyStudyTime` is a nullable local `HH:mm` value. Existing records normalize to the documented defaults without migration. The user's existing `settings.studyTimezone` remains the only timezone. Preference patches use dotted paths and preserve unrelated settings. Account deletion removes notifications inside the existing required transaction. Full account data export includes notification history and preferences; clear-history and delete-materials operations retain their established study-only semantics.

## Phase 2 frontend

The authenticated shell wraps its existing navbar bell, dropdown, and route content in a user-keyed notification provider. The provider fetches only the unread count at initialization and on focus/visibility changes; the bell fetches the latest five items only while opened. Account identity is keyed by the authenticated shell, and notification state is kept in memory only. A shared notification row and centralized category presentation are used by both the dropdown and `/notifications`.

The Notification Center requests bounded pages from `GET /api/notifications`, appending with the opaque `(createdAt, _id)` cursor. The supported filters are All, Unread, Reminders, Achievements, and System. The group filters use the validated `group=reminders|achievements|system` query, mapped server-side to the registry types; single-type filters remain supported by the API for future use. Category destinations use only the validated `target` returned by the backend. Read actions use the existing PATCH routes and refresh the shared unread count. The Settings section uses the dedicated preferences API and retains the existing study timezone.

The dropdown is portaled to the document body so it escapes the authenticated shell's clipped scroll region. On narrow screens it becomes a viewport-contained sheet above the mobile navigation. It closes on Escape, outside interaction, route changes, and opening the profile menu. Motion is brief and reduced to opacity for users requesting reduced motion.

## Phase 2 scope and limits

Phase 2 only displays and manages notifications already persisted by trusted server services. There are no notification producers in the client, no generated sample records, and no scheduling or polling. Users may therefore see an empty inbox until later producer phases ship. The navbar refreshes the count at shell initialization and when the page regains focus; live delivery is not provided.

Future phases: Phase 3 integrates verified badge/quiz/security/announcement events; Phase 4 defines reminder scheduling, timezone behavior, expiry, retries, and retention; Phase 5 adds focused end-to-end/production QA. Producers should use stable event keys, avoid placing answers/secrets in metadata, and treat notification delivery as non-authoritative.
