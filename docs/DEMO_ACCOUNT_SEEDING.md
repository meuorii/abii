# Internal demo account seeding

The seeder creates Abii's private marketing screenshot account using the normal
User, subject, topic, flashcard, quiz, review, and badge models. It does not add
a demo login path or seed client-side display data. Sign in through `/login`.

## Configuration

Set these values in the shell that runs the command. The script does not load
`.env` files:

```powershell
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/abii_demo_dev'
$env:ABII_DEMO_EMAIL = 'your-private-demo-email@example.com'
$env:ABII_DEMO_PASSWORD = 'use-a-private-password'
$env:ABII_DEMO_SEED_ENV = 'development'
```

Use a dedicated development or staging database and credentials scoped to that
database. The URI must include a database name. Production or production-looking
writes are refused unless an operator explicitly passes
`--production-authorized`; this is a final safeguard, not a substitute for
checking the URI and environment yourself.

## Commands

The default command is a dry run. It validates the environment and content and
prints the planned counts without connecting to MongoDB or writing records:

```powershell
npm run seed:demo
```

Apply the seed to the configured database:

```powershell
npm run seed:demo -- --apply
```

Refresh the academic data and recent study history after reviewing the target.
Refresh requires the exact configured email as a confirmation argument:

```powershell
npm run seed:demo -- --refresh --confirm-email=$env:ABII_DEMO_EMAIL
```

For a production target, both a write flag and explicit authorization are
required. Prefer an isolated staging copy for screenshots:

```powershell
npm run seed:demo -- --apply --production-authorized
```

The initial apply hashes the configured password with the same bcrypt cost used
by registration. Reruns do not reset an existing demo account's password. An
email that belongs to an account without the seeder's private ownership marker
is rejected. Refresh only works for the marked demo account with the matching
confirmed email; it does not delete other user data.

## Seeded content and verification

The content plan contains five subjects, three subject folders, 15 topic
folders, 20 topics, and 90 flashcards (68 standard and 22 enumeration). It also
creates 20 completed quizzes across all five subjects and four existing quiz
modes, with associated answer history and review records. Dates are anchored to
the run date in `Asia/Manila`. Repeating a seed on the same study date uses
stable record IDs and does not duplicate that day's content or activity. On a
later date, the rolling seven-day activity window advances and records retain
their stable date-specific IDs.

Completed quiz sessions use the existing 24-hour TTL index. Their expiry is set
to 24 hours after the seed run so the complete screenshot set remains available
for that period. Run `--refresh` before a later screenshot session; normal
application TTL cleanup remains enabled. Review records remain as genuine
learning history and drive mastery, activity, streak, and accuracy calculations.
Badges are awarded by the existing reconciliation logic and featured selections
include only earned badges.

After applying, sign in normally and verify:

- Dashboard and profile show the account name `User`.
- Subjects shows Biology, World History, General Mathematics, English & Literature,
  and Earth Science with their subject folders.
- Subject and topic details show their folder organization and usable standard
  and enumeration cards.
- Review can start real sessions using the existing quiz setup.
- Progress shows recent activity, review accuracy, and calculated mastery.
- Badges shows eligible unlocked badges and the remaining locked catalog.

The command prints actual counts, mastery, streak, accuracy, and earned badge
IDs after each apply. Keep the email, password, and MongoDB URI private; they are
read from environment variables and are never included in the script output.
