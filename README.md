# Abii Active Recall

Abii organizes study material into Subjects, Topics, and Flashcards. Topics can
contain Standard cards and Enumeration (`items`) cards. The same quiz engine
supports All Subjects, one Subject, or one Topic review.

## Topic system

```text
User
└── Subjects
    └── Topics
        └── Flashcards
            ├── Standard
            └── Enumeration (`items`)

Review Setup
├── All Subjects
├── Specific Subject
└── Specific Topic

Quiz modes
├── Multiple Choice
├── Identification
├── True or False
└── Mixed / Random

Mastery
├── Topic
├── Subject
└── Overall
```

See [Topic implementation and QA](docs/TOPIC_IMPLEMENTATION.md) for the data
model, API contract, user workflow, mastery rules, and verification results.

## Local development

Use Node.js supported by the installed Next.js and MongoDB test dependencies.
Create `.env.local` with a development `MONGODB_URI` and the authentication
settings documented in `lib/auth/constants.ts`. Start the app with:

```bash
npm install
npm run dev
```

Topic mutations and cleanup operations use MongoDB transactions. Use a local
single-node replica set or another replica set / sharded MongoDB deployment.
Standalone MongoDB fails closed for these writes.

## Existing flashcards and migration

Flashcard `topicId` remains optional in the schema for backwards-compatible
reads. Existing unassigned cards should be assigned to a subject's `General`
Topic using the migration before relying on topic-specific organization. The
migration is dry-run by default, requires an explicitly selected database, and
is safe to rerun. Read [migration instructions](scripts/README.md) before using
it. No production migration is run automatically by the app or test suite.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Integration tests use temporary in-memory MongoDB instances. They do not use
the application database URI. `npm test` includes schema/migration, Topic API,
mastery, quiz compatibility, and authenticated HTTP route tests.
