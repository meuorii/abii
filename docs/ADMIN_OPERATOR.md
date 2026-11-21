# Private administrator operations

Only an authorized operator with database credentials may run these commands. Obtain the approved environment, primary replica-set name, connection host and database name independently from deployment inventory. Use a private interactive terminal with recording, transcripts, screen sharing and shell tracing disabled. The CLI refuses redirected input/output and accepts one action word. It suppresses input echo for sensitive prompts. Never use a production connection for tests.

## Configuration and deployment

1. Deploy compatible ordinary session readers, the account write protections, MFA endpoints and audit writers before provisioning. Keep admin routes closed. Confirm authenticated TLS, restrict operator network access and enable majority writes. Back up the existing database and encryption keys separately.
2. Inject MONGODB_URI, AUTH_SECRET, AUTH_OTP_SECRET, ADMIN_MFA_KEY_ID and ADMIN_MFA_KEYS from deployment secret management. The keyring maps short identifiers to base64-encoded random 32-byte AES keys. Retain decrypt capability for the stored key ID until verified rotation and backup expiry. Never put credentials or a URI in command arguments or shell history. Supply the same keyring and trusted APP_BASE_URL to the application.
3. Confirm current user indexes and identity data on the approved target. The verifier requires an existing users collection with binary/simple collation and a unique, unfiltered email index (existing model name user_email_unique). If absent, review email duplicates and deploy that existing index additively under database change control first. Provisioning does not repair identity data. Deploy the AuthRateLimit unique key/window and expiration indexes, AdminAuditLog and AdminSecurityEvent retention indexes and the AdminFactor collection before opening the operator window. Where automatic creation is disabled, run the existing model-specific createCollection/createIndexes operations under separate deployment authorization. Verify and identity operations check these prerequisites read-only. Prepare creates only the single-admin index.
4. Grant the operator enough access for hello, getCmdLineOpts, listCollections, listIndexes, scoped identity reads and transaction writes. Use a separately approved createIndex privilege for prepare. The CLI disables Mongoose automatic creation. Sharded deployments, config servers, standalone servers and deployments that cannot supply positive topology evidence are unsupported. Some managed roles may prohibit getCmdLineOpts. Obtain an authorized capability or qualify an alternative topology attestation before rollout.
5. Run commands from the repository root with the repository dependencies. Each action compares the independently supplied host list to the configured MongoDB seed hosts (or SRV hostname), then asks for the expected database, replica set and explicit confirmation. Use the connection string for the intended database itself. The script checks the selected DB and live server response. Do not override this safeguard.
6. Give the application credential `listIndexes` access on the users collection. MFA completion and administrator session validation return 503 if the primary cannot confirm the single-admin unique index. Ordinary sign-in does not use this check.

Validate without changes:

```
node --conditions=react-server --import ./scripts/register-typescript.mjs scripts/admin-operator.ts verify
```

In a separately authorized deployment window, run the same command with **prepare** to build user_single_admin_unique. Verify reads back the entire key, uniqueness, partial filter and effective collation and probes a hinted lookup. It rejects malformed roles, more than one existing admin and conflicting role indexes. Inspect failures privately with a read-only credential. The action does not drop or replace indexes.

## Provision and enroll

Run the same command with **provision**. Confirm mailbox ownership using the organization's independent identity process and record operator identity/approval in the private deployment record. Enter a new normalized email and a password-manager-generated password twice (16 or more characters, at most 72 UTF-8 bytes). The action refuses an existing ordinary identity. An already-provisioned matching admin is preserved. The account, protected pending enrollment and audit evidence are committed together. Within the ten-minute enrollment window, transfer the displayed setup key directly to the administrator authenticator and confirm the six-digit code. Store the once-displayed recovery codes offline in separate controlled custody. Close/dispose of the terminal scrollback securely. The CLI never puts the setup key or recovery codes in shell command history.

A process interruption before enrollment confirmation leaves a pending account. After its proof expires, run **resume** on the same target, verify the mailbox and enter the existing password. Resume can replace only an expired, pending enrollment, cannot replace an active factor, and does not grant an admin session. If the final code display was interrupted after commit, use **rotate** with the current authenticator.

## Rotate or recover the same identity

**rotate** requires independent operator approval, mailbox verification, the existing password and a fresh TOTP step. Complete replacement enrollment and move new codes to offline custody. **recover** requires operator authentication to the database, independent identity verification and one unused offline recovery code. Enter and confirm a strong replacement password. The operation consumes the credential, invalidates sessions and moves the account to pending enrollment before displaying the new setup key. Complete enrollment and replace old offline codes. For interruption, follow the pending-enrollment procedure with the replacement password. A recovery code alone cannot authenticate to the website. For a keyring rotation, configure both keys first, select the new write key, rotate and confirm login before retiring the old key.

If both the factor and offline recovery material are lost, escalate to the organization's authorized incident/backup process. There is no public reset or emergency password. Plan custody and rehearse recovery on an isolated deployment **before** activation. For each rehearsal verify old sessions, pending challenges and prior recovery codes fail, the account ID is unchanged and the redacted audit records exist.

## Rollback

Disable admin access at ingress first. Perform an authenticated all-device administrator logout or approved credential rotation and confirm saved credentials from before revocation fail. Keep the uniqueness index, audit evidence, compatible account deletion/reset protections and key custody in place. Revoke the temporary provisioning credential. Restore access only after rechecking indexes, native transaction support, keyring, trusted origin, MFA, logout, audit writes and recovery rehearsal.


