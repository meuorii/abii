# Support page and contact form

The public Support page is available at `/support`. Its Help Center, FAQ, and Contact Us sections are addressable at `#help-center`, `#faqs`, and `#contact`.

## Contact delivery configuration

Set `SUPPORT_INBOX_EMAIL` to a mailbox controlled by the Abii team. The endpoint also requires the existing `BREVO_API_KEY`, verified `BREVO_SENDER_EMAIL`, optional `BREVO_SENDER_NAME`, `APP_BASE_URL`, and an `AUTH_OTP_SECRET` of at least 32 characters. Keep all of these values server-side. `EMAIL_ASSET_BASE_URL` must remain configured according to the existing Brevo email setup.

Contact messages use the existing Brevo transactional sender. The visitor address is set as reply-to; it is never used as the sender or recipient. A successful API response means Brevo accepted the send request, not that a message reached the destination inbox.

The API validates the origin and request size, validates every field on the server, applies persistent email and global rate limits, optionally applies an IP limit when a trusted proxy header is configured, and uses a honeypot plus a short-lived idempotency record. Support submission records contain only an HMAC request key and delivery state; message content is not persisted.

Run `npm run test:support` for focused validation and email escaping tests. Live delivery requires production Brevo credentials and a configured support mailbox.
