# Abii administrator operations

The administrator lives at `abii.admins` with `_id: "primary"`. Use a private interactive terminal with recording, transcripts, shell tracing, and screen sharing disabled. Enter passwords and codes at the hidden prompts. Keep the displayed setup key and recovery codes out of logs and change records.

## Before production setup

1. Roll out the dedicated-admin authentication code to every deployment connected to `abii`. Keep `ABII_ADMIN_UI_ENABLED` disabled until the approved smoke test. Pause and drain public registration and any other process that creates users or changes user email addresses during first setup. The `users` email index covers only its own collection. The command checks for a collision before claim and activation, and the web app reserves the email as soon as the pending administrator commits.
2. Verify an independent restore of the approved backup and record the result. `abii-20261122-103544.archive.gz` passed a restore dry-run. An independent restore has yet to be completed. Back up the MFA keyring in approved offline custody. Record production change authorization and verify ownership of a dedicated administrator mailbox out of band.
3. Set `MONGODB_URI` in the gitignored `.env.local` to the approved Atlas URI selecting `/abii`. Use the scoped operator credential and Node 22.15 or newer. Set `APP_BASE_URL` to the trusted HTTPS application origin. For local sign-in the CLI also accepts `http://localhost:3000`. Load the existing `AUTH_SECRET` and `AUTH_OTP_SECRET` (at least 32 characters each) to preserve the current application session and rate-limit configuration. Set `ADMIN_MFA_KEY_ID` and `ADMIN_MFA_KEYS` (a JSON map of key IDs to base64-encoded random 32-byte AES keys). Configure the matching keyring and trusted origin in the app. Confirm synchronized clocks and the existing trusted proxy IP configuration.

Administrator web sessions use an eight-hour absolute maximum, a 30-minute server-enforced inactivity timeout, and the existing five-minute fresh-authentication window. New sign-in always requires password and TOTP. Keep `AUTH_SECRET` stable across restarts and deployments within one environment, and configure distinct secrets for development and production. Session metadata is stored in the existing `admins.primary` document without an index or schema migration. After rollout, existing administrator JWTs lacking the new session and environment claims are rejected and require sign-in. When local and production installations share the `abii.admins` singleton, a fresh login in either environment replaces the active session and invalidates the other environment's session; token environment bindings still prevent cross-environment token use.
4. Load the independently approved Atlas inventory into the gitignored `.env.admin-inventory.local`. Use the Atlas project and cluster approval record for `abii` on `atlas-v6lmhk-shard-0`. The CLI pins approved seeds and member hostnames, validates TLS, and verifies authenticated membership and primary identity. [Atlas cluster inventory](https://www.mongodb.com/docs/api/doc/atlas-admin-api-v2/operation/operation-getgroupcluster) · [MongoDB hello](https://www.mongodb.com/docs/manual/reference/command/hello/)

   | Inventory variable | Approved value |
   | --- | --- |
   | `ABII_ADMIN_ATLAS_CLUSTER_TYPE` | `REPLICASET` |
   | `ABII_ADMIN_BOOTSTRAP_HOSTS` | SRV hostname or comma-separated standard seed hosts matching the URI format and ports |
   | `ABII_ADMIN_ATLAS_MEMBERS` | Complete comma-separated member endpoints, each including `:27017` |

5. Confirm the existing simple-collation `users` collection and unique email index, as well as the existing security storage below. The setup preflight checks collection metadata and indexes before asking for approval. Obtain **separate database change approval** if any security collection or index needs preparation. Give the operator read access and `listCollections`/`listIndexes` for these checks, scoped writes to `admins` and existing security storage, and permission to create only `admins`. Give the application the scoped reads and writes for shared login, MFA, revocation, and audit, including permission to check audit collection existence. Transactions require the approved replica set.

   | Existing storage | Required indexes |
   | --- | --- |
   | `authratelimits` | Unique `{ key: 1, window: 1 }`, TTL on `expiresAt` with zero seconds |
   | `adminauditlogs` | 365-day TTL on `occurredAt`, `{ targetId: 1, occurredAt: -1 }` |
   | `adminsecurityevents` | 90-day TTL on `occurredAt`, `{ kind: 1, occurredAt: -1 }` |

If setup reports a legacy `role: "admin"` row in `users`, keep admin access closed. Have the database owner verify the identity and any learner-data ownership, revoke legacy access, and archive and retire the legacy administrator row from `users` under a separately approved change. If the record has learner data or ambiguous ownership, resolve that with the data owner first. Leave the legacy index and historical factor and audit evidence in place. A conflicting email or unexpected `admins` document also requires separately approved review and resolution.

## Provision and enroll

```sh
npm run admin:setup
```

Supply the display name, dedicated normalized email and a password-manager-generated password of at least 16 characters and at most 72 UTF-8 bytes. When the read-only checks and production prerequisites are complete, type `AUTHORIZE SETUP atlas-v6lmhk-shard-0/abii` at the single write checkpoint.

The first audited transaction inserts the fixed `primary` document in pending state. MongoDB creates `admins` and its built-in unique `_id` index on the first committed insert. The command writes only the administrator record and related events or rate counters in existing security storage. [MongoDB unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/) · [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/)

Add the privately displayed key in Google Authenticator as time-based (6 digits, SHA-1, 30 seconds). Enter the current code within ten minutes. Successful verification activates the account and displays eight recovery codes once. Save them offline, then clear the terminal scrollback. Enrollment consumes the accepted TOTP step. Wait for Google Authenticator to show a new code before signing in at `/login`. Verify the dashboard and logout in the approved smoke test before opening admin routes to the intended audience. Resume ordinary registration after setup and revoke the temporary operator credential.

An interruption before activation leaves the account pending and ineligible for sessions. After the ten-minute window, rerun `npm run admin:setup` with the original email and password to replace expired enrollment. An active administrator makes repeated setup return without writes. If activation committed before you saved the recovery codes, use the current authenticator to rotate them.

If setup stops after approval, use the stage, error category, and any numeric database code printed to stderr when reporting it. The audit storage check uses an exact name for each collection because the approved Atlas deployment rejects a multi-name filter. A failure during the restart audit write rolls back the replacement enrollment. Rerun setup to check the current account state.

## Rotate or recover

- `npm run admin:setup -- rotate` requires the existing password and a fresh Google Authenticator code.
- `npm run admin:setup -- recover` requires independent operator and mailbox verification, one unused offline recovery code, and a confirmed replacement password.

Use the matching `AUTHORIZE` prompt for each operation. Both actions revoke all administrator sessions and invalidate the previous recovery-code set as they move the same identity to pending enrollment. Complete Google Authenticator enrollment and save the new codes offline. If interrupted, use the pending procedure with the current password. Recovery codes are private operator credentials. The website requires TOTP. Keep the old decryption key available through a normal key rotation and verify sign-in with the new key before retiring it. If the old key is lost, approved recovery can use a valid offline code and a newly configured keyring. If both the authenticator and recovery material are lost, use the authorized incident and backup process.

## Close or roll back access

Disable `ABII_ADMIN_UI_ENABLED` at ingress. Revoke all administrator sessions through authenticated logout or approved credential rotation. If an authorized database operator suspends or restores the account, increment `sessionVersion` atomically with the status change. Preserve the dedicated identity, audit evidence, and key custody, and keep role isolation in any rollback deployment.
