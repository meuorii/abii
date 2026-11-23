# Support page and contact form

The public Support page is available at `/support`. Its Help Center, FAQ, and Contact Us sections are addressable at `#help-center`, `#faqs`, and `#contact`.

## Contact delivery configuration

Set `SUPPORT_INBOX_EMAIL` to a mailbox controlled by the Abii team. The endpoint also requires the existing `BREVO_API_KEY`, verified `BREVO_SENDER_EMAIL`, optional `BREVO_SENDER_NAME`, `APP_BASE_URL`, and an `AUTH_OTP_SECRET` of at least 32 characters. Keep all of these values server-side. `EMAIL_ASSET_BASE_URL` must remain configured according to the existing Brevo email setup.

Contact messages use the existing Brevo transactional sender. The visitor address is set as reply-to; it is never used as the sender or recipient. A successful API response means Brevo accepted the send request, not that a message reached the destination inbox.

## Persistent ticket storage

Each accepted contact request also creates a permanent support ticket and its initial encrypted activity record. Set `SUPPORT_TICKET_ENCRYPTION_KEY` to a dedicated base64-encoded 32-byte AES-256-GCM key. `SUPPORT_TICKET_ENCRYPTION_KEY_ID` identifies that key in stored records and must remain stable while records encrypted with it are retained. A record with a different key ID fails closed; key rotation requires an operator-approved reader/migration plan.

The temporary submission reservation remains short-lived, but the durable ticket keeps the HMAC submission identity and payload fingerprint. Replays with the same payload acknowledge the existing request; conflicting reuse is rejected. Ticket, activity, and response-operation collections require the declared unique and timeline indexes in `models/SupportTicket.ts`; auto-indexing is disabled, so provision them only on approved staging or production infrastructure. A MongoDB replica set or sharded deployment is required for transaction-backed creation and privileged mutation.

Administrator replies use the configured support mailbox as Brevo reply-to. `accepted` means Brevo accepted the request; it is not final inbox delivery. `uncertain` means the provider result could not be confirmed and must be reconciled manually from verified provider evidence—never blindly resend it. Inbound email replies are not synchronized into Abii.

The administrator workflow is `New → Open → Awaiting Reply → Resolved`, with direct resolution of New/Open tickets and reopening from Resolved to Open. Every manual status change is revision-checked and recorded in the encrypted-ticket timeline. The workspace initially retrieves the newest 50 activities and provides cursor-based older-history loading. Response-operation IDs are retained per ticket in browser session storage only; this stores no correspondence and prevents a refresh or repeated click from creating a new operation for the same uncertain attempt.

The API validates the origin and request size, validates every field on the server, applies persistent email and global rate limits, optionally applies an IP limit when a trusted proxy header is configured, and uses a honeypot plus a short-lived idempotency record. Temporary submission records contain only delivery data. Customer correspondence is persisted only in the encrypted ticket-activity collection and is readable only through the MFA-protected administrator workspace.

Run `npm run test:support` for focused validation and email escaping tests. Live delivery requires production Brevo credentials and a configured support mailbox.

Run `npm run test:support-management` for isolated replica-set transaction and activity-cursor coverage, and `npm run test:brevo` for mocked Brevo request/response coverage. Neither command performs external delivery.
