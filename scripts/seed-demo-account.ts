import "server-only";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import mongoose, { Types } from "mongoose";
import { User } from "../models/User";
import { Subject } from "../models/Subject";
import { SubjectFolder, normalizeSubjectFolderName } from "../models/SubjectFolder";
import { Folder } from "../models/Folder";
import { Topic } from "../models/Topic";
import { Flashcard } from "../models/Flashcard";
import { QuizSession } from "../models/QuizSession";
import { ReviewRecord } from "../models/ReviewRecord";
import { AchievementEvent } from "../models/AchievementEvent";
import { UserBadge } from "../models/UserBadge";
import { BadgeReconciliation } from "../models/BadgeReconciliation";
import { DEMO_SUBJECTS, validateDemoDataset } from "./demo-seed-data";
import { studyDayKey, currentConsecutiveDayStreak } from "../lib/badges/study-day";
import { getSubjectMastery } from "../lib/quiz/service";
import { reconcileUserBadges } from "../lib/badges/reconcile";
import { fetchEarnedBadges, updateFeaturedBadgeSelection } from "../lib/badges/repository";

const { ConnectionString } = createRequire(import.meta.url)("mongodb-connection-string-url") as {
  ConnectionString: new (uri: string) => { pathname: string; hosts: string[] };
};

export const DEMO_SEED_KEY = "abii-internal-marketing-demo-v1";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_MODES = ["identification", "multiple-choice", "true-false", "random"] as const;
type SeedEnvironment = { MONGODB_URI?: string; ABII_DEMO_EMAIL?: string; ABII_DEMO_PASSWORD?: string; ABII_DEMO_SEED_ENV?: string };
export type SeedOptions = { apply?: boolean; refresh?: boolean; productionAuthorized?: boolean; confirmedEmail?: string; env?: SeedEnvironment; now?: Date };

const normalizedEmail = (email: string) => email.trim().toLowerCase();
const stableId = (key: string) => new Types.ObjectId(createHash("sha256").update(`${DEMO_SEED_KEY}:${key}`).digest("hex").slice(0, 24));

function validateTarget(options: SeedOptions) {
  const env = options.env ?? process.env;
  const uri = env.MONGODB_URI?.trim();
  const email = env.ABII_DEMO_EMAIL?.trim();
  const password = env.ABII_DEMO_PASSWORD;
  const environment = env.ABII_DEMO_SEED_ENV?.trim().toLowerCase();
  if (!uri || !email || !password) throw new Error("Set MONGODB_URI, ABII_DEMO_EMAIL and ABII_DEMO_PASSWORD before running the demo seeder.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) throw new Error("ABII_DEMO_EMAIL must be valid and ABII_DEMO_PASSWORD must contain at least 8 characters.");
  if (!environment || !["development", "test", "staging", "production"].includes(environment)) throw new Error("Set ABII_DEMO_SEED_ENV to development, test, staging, or production.");
  let parsed: InstanceType<typeof ConnectionString>;
  try { parsed = new ConnectionString(uri); } catch { throw new Error("MONGODB_URI must be a valid MongoDB connection URI."); }
  let databaseName = "";
  try { databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, "").split("/")[0] ?? ""); }
  catch { throw new Error("MONGODB_URI must contain a valid explicitly named database."); }
  if (!databaseName) throw new Error("MONGODB_URI must name a database; the seeder will not use the MongoDB default database.");
  const targetText = `${parsed.hosts.join("/")}/${databaseName}`.toLowerCase();
  const looksProduction = /(^|[.-])(prod|production)([.-]|$)/.test(targetText);
  if (options.apply && (environment === "production" || looksProduction) && !options.productionAuthorized) throw new Error("Production-looking writes are refused unless --production-authorized is supplied explicitly.");
  if (options.refresh && normalizedEmail(options.confirmedEmail ?? "") !== normalizedEmail(email)) throw new Error("Refresh requires --confirm-email to exactly match ABII_DEMO_EMAIL.");
  return { uri, email: normalizedEmail(email), password, environment, databaseName };
}

export function makeDemoPlan() {
  const data = validateDemoDataset();
  return { ...data, subjectFolders: 3, topicFolders: 15, completedQuizSessions: 20, studyDays: 7, timezone: "Asia/Manila" };
}

function studyDateKeys(now: Date, count: number) {
  const today = studyDayKey(now, "Asia/Manila");
  const [year, month, day] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - (count - 1 - index)));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  });
}

function dateAtStudyTime(dayKey: string, now: Date) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const planned = new Date(Date.UTC(year, month - 1, day, 0, 30));
  return new Date(Math.min(planned.getTime(), now.getTime() - 60_000));
}

function answersForQuestion(card: { flashcardType: string; answer: string }) {
  return card.flashcardType === "items" ? card.answer.split("; ") : undefined;
}

async function upsert<T>(model: mongoose.Model<T>, id: Types.ObjectId, owner: Types.ObjectId, fields: Record<string, unknown>) {
  await model.updateOne({ _id: id, userId: owner }, { $set: fields, $setOnInsert: { _id: id, userId: owner } }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
}

type SeedIndexOptions = { name?: string; unique?: boolean; expireAfterSeconds?: number; partialFilterExpression?: unknown; [key: string]: unknown };

async function ensureDeclaredIndexes<T>(model: mongoose.Model<T>) {
  const collection = model.collection;
  let existing: Array<{ key?: Record<string, unknown>; unique?: boolean; expireAfterSeconds?: number; partialFilterExpression?: unknown }> = [];
  try { existing = await collection.indexes(); }
  catch (error) {
    if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 26) throw error;
  }
  const keySignature = (keys: Record<string, unknown>) => JSON.stringify(Object.entries(keys));
  const seen = new Map<string, SeedIndexOptions>();
  for (const [keys, rawOptions] of model.schema.indexes()) {
    const signature = keySignature(keys as Record<string, unknown>);
    const options = rawOptions as SeedIndexOptions;
    const duplicateDefinition = seen.get(signature);
    if (duplicateDefinition) {
      if (Boolean(duplicateDefinition.unique) !== Boolean(options.unique) || duplicateDefinition.expireAfterSeconds !== options.expireAfterSeconds) throw new Error(`${model.modelName} declares incompatible indexes for the same key pattern.`);
      continue;
    }
    seen.set(signature, options);
    const already = existing.find(index => keySignature(index.key as Record<string, unknown>) === signature);
    if (already) {
      if (Boolean(already.unique) !== Boolean(options.unique) || already.expireAfterSeconds !== options.expireAfterSeconds || JSON.stringify(already.partialFilterExpression ?? null) !== JSON.stringify(options.partialFilterExpression ?? null)) {
        throw new Error(`${model.modelName} has a conflicting existing index for ${JSON.stringify(keys)}; the seeder will not replace it.`);
      }
      continue;
    }
    const name = options.name ? String(options.name) : undefined;
    await collection.createIndex(keys as Record<string, 1 | -1>, { ...options, ...(name ? { name } : {}) } as mongoose.mongo.CreateIndexesOptions);
    existing.push({ key: keys, ...options, ...(name ? { name } : {}) });
  }
}

function makeSnapshot(card: { _id: Types.ObjectId; question: string; answer: string; flashcardType: string }, mode: typeof SESSION_MODES[number], correct: boolean, distractors: string[]) {
  const items = answersForQuestion(card);
  const type = mode === "random" ? (items ? "enumeration-identification" : "identification")
    : mode === "identification" && items ? "enumeration-identification"
      : mode === "multiple-choice" && items ? "enumeration-multiple-choice" : mode;
  const wrongOption = distractors.find(answer => answer !== card.answer && (items ? answer.includes(";") : !answer.includes(";"))) ?? "An answer from a different lesson.";
  const statement = correct ? `${card.question} ${card.answer}` : `${card.question} ${wrongOption}`;
  const question: Record<string, unknown> = {
    type, flashcardId: card._id, prompt: card.question, expectedAnswer: card.answer,
    ...(items ? { expectedItems: items } : {}), answered: true, correct, round: 1, reviewRecordPending: false,
  };
  if (mode === "multiple-choice" || type === "enumeration-multiple-choice") {
    question.options = [card.answer, wrongOption, ...distractors.filter(answer => answer !== card.answer && answer !== wrongOption).slice(0, 2)];
    question.correctIndex = 0;
    question.selectedIndex = correct ? 0 : 1;
  }
  if (mode === "true-false") {
    question.statement = statement;
    question.truth = correct;
    question.selectedTruth = true;
    question.userAnswer = "True";
  }
  if (type === "identification") question.userAnswer = correct ? card.answer : "I am still reviewing this one.";
  if (type === "enumeration-identification") question.userAnswers = correct ? items : items?.slice(0, Math.max(1, (items?.length ?? 1) - 1));
  return question;
}

export async function applyDemoSeed(options: SeedOptions = {}) {
  const target = validateTarget({ ...options, apply: true });
  const now = options.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new Error("Seed clock must be a valid date.");
  const previousMongoUri = process.env.MONGODB_URI;
  process.env.MONGODB_URI = target.uri;
  try {
    await mongoose.connect(target.uri, { dbName: target.databaseName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10_000 });
    const existing = await User.findOne({ email: target.email }).select("+passwordHash +demoSeedKey").lean();
    const markerOwner = await User.findOne({ demoSeedKey: DEMO_SEED_KEY }).select("+demoSeedKey").lean();
    if (existing && existing.demoSeedKey !== DEMO_SEED_KEY) throw new Error("The configured email belongs to an account without the demo ownership marker; refusing to modify it.");
    if (markerOwner && normalizedEmail(String(markerOwner.email)) !== target.email) throw new Error("The demo ownership marker belongs to a different email; refusing to take ownership.");
    const userId = existing?._id instanceof Types.ObjectId ? existing._id : stableId("user");
    const idCollision = await User.findById(userId).select("email +demoSeedKey").lean();
    if (idCollision && idCollision.demoSeedKey !== DEMO_SEED_KEY) throw new Error("The stable demo account ID is occupied by another account.");
    // Add declared indexes individually, including QuizSession TTL. Duplicate
    // equivalent key specs in schemas are deduplicated; no existing index is dropped.
    await ensureDeclaredIndexes(User);
    await ensureDeclaredIndexes(Subject);
    await ensureDeclaredIndexes(SubjectFolder);
    await ensureDeclaredIndexes(Folder);
    await ensureDeclaredIndexes(Topic);
    await ensureDeclaredIndexes(Flashcard);
    await ensureDeclaredIndexes(QuizSession);
    await ensureDeclaredIndexes(ReviewRecord);
    await ensureDeclaredIndexes(AchievementEvent);
    await ensureDeclaredIndexes(UserBadge);
    await ensureDeclaredIndexes(BadgeReconciliation);
    const passwordHash = existing ? undefined : await bcrypt.hash(target.password, 12);
    await User.updateOne({ _id: userId }, { $set: {
      name: "User", email: target.email, emailVerifiedAt: existing?.emailVerifiedAt ?? now,
      "settings.studyTimezone": "Asia/Manila", "settings.targetSubjects": 5, demoSeedKey: DEMO_SEED_KEY,
      ...(passwordHash ? { passwordHash } : {}),
    }, $setOnInsert: { _id: userId, sessionVersion: 0 } }, { upsert: true, runValidators: true });

    const folderIds = new Map<string, Types.ObjectId>();
    for (const [position, name] of ["Science Subjects", "Humanities", "Mathematics"].entries()) {
      const id = stableId(`subject-folder:${name}`); folderIds.set(name, id);
      await upsert(SubjectFolder, id, userId, { name, normalizedName: normalizeSubjectFolderName(name), description: "Academic subject collection", position });
    }
    const subjectIds = new Map<string, Types.ObjectId>();
    const topicIds = new Map<string, Types.ObjectId>();
    const cards: Array<{ _id: Types.ObjectId; subjectId: Types.ObjectId; topicId: Types.ObjectId; topicName: string; question: string; answer: string; flashcardType: "standard" | "items" }> = [];
    const topicFolderCounts = new Map<string, number>();
    for (const subjectData of DEMO_SUBJECTS) {
      const subjectId = stableId(`subject:${subjectData.name}`); subjectIds.set(subjectData.name, subjectId);
      await upsert(Subject, subjectId, userId, { name: subjectData.name, subjectFolderId: folderIds.get(subjectData.folder)! });
      let topicPosition = 0;
      for (const group of subjectData.topicFolders) {
        const folderId = stableId(`topic-folder:${subjectData.name}:${group.name}`);
        const folderPosition = topicFolderCounts.get(subjectData.name) ?? 0;
        topicFolderCounts.set(subjectData.name, folderPosition + 1);
        await upsert(Folder, folderId, userId, { subjectId, name: group.name, normalizedName: group.name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase(), description: `Lessons for ${subjectData.name}`, position: folderPosition });
        for (const topic of group.topics) {
          const topicId = stableId(`topic:${subjectData.name}:${topic.name}`); topicIds.set(`${subjectData.name}:${topic.name}`, topicId);
          await upsert(Topic, topicId, userId, { subjectId, folderId, name: topic.name, normalizedName: topic.name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase(), position: topicPosition++ });
          for (const [index, card] of topic.cards.entries()) {
            const id = stableId(`card:${subjectData.name}:${topic.name}:${index}`);
            const answer = card.items ? card.items.join("; ") : card.answer;
            await upsert(Flashcard, id, userId, { subjectId, topicId, flashcardType: card.items ? "items" : "standard", question: card.question, answer });
            cards.push({ _id: id, subjectId, topicId, topicName: topic.name, question: card.question, answer, flashcardType: card.items ? "items" : "standard" });
          }
        }
      }
    }

    const dayKeys = studyDateKeys(now, 7);
    const schedule: Array<{ day: number; subject: string; mode: typeof SESSION_MODES[number]; serial: number }> = [];
    for (const [modeIndex, mode] of SESSION_MODES.entries()) for (let attempt = 0; attempt < 3; attempt++) schedule.push({ day: (modeIndex * 3 + attempt) % 7, subject: "Biology", mode, serial: modeIndex * 3 + attempt });
    const otherSubjects = ["World History", "General Mathematics", "English & Literature", "Earth Science", "General Mathematics", "World History", "Earth Science", "English & Literature"];
    for (let index = 0; index < otherSubjects.length; index++) schedule.push({ day: (index * 3 + 1) % 7, subject: otherSubjects[index], mode: SESSION_MODES[(index + 1) % SESSION_MODES.length], serial: 12 + index });
    schedule.sort((a, b) => a.day - b.day || a.serial - b.serial);
    const sessions: Types.ObjectId[] = [];
    for (const planned of schedule) {
      const scopedCards = cards.filter(card => card.subjectId.equals(subjectIds.get(planned.subject)!));
      const anchors = planned.subject === "Biology" ? scopedCards.slice(0, 6) : [];
      const rotatingCards = scopedCards.filter(card => !anchors.some(anchor => anchor._id.equals(card._id)));
      const start = (planned.serial * 3) % rotatingCards.length;
      const rotationCount = planned.subject === "Biology" ? 2 : 8;
      const questions = [...anchors, ...Array.from({ length: rotationCount }, (_, index) => rotatingCards[(start + index) % rotatingCards.length])];
      const completedAt = dateAtStudyTime(dayKeys[planned.day], now);
      const sessionId = stableId(`quiz:${dayKeys[planned.day]}:${planned.serial}:${planned.subject}:${planned.mode}`); sessions.push(sessionId);
      const distractors = scopedCards.map(card => card.answer);
      const snapshots: Array<Record<string, unknown>> = questions.map((card, index) => {
        const anchor = anchors.some(item => item._id.equals(card._id));
        const correct = anchor ? true : (index + planned.serial) % (planned.serial % 4 === 0 ? 3 : 5) !== 0;
        const question = makeSnapshot(card, planned.mode, correct, distractors) as Record<string, unknown>;
        question.answeredAt = new Date(completedAt.getTime() - (questions.length - index) * 45_000);
        return { ...question, achievementSubjectId: card.subjectId, achievementDayKey: dayKeys[planned.day] };
      });
      await QuizSession.updateOne({ _id: sessionId, userId }, { $set: {
        subjectId: subjectIds.get(planned.subject), subjectName: planned.subject, scope: "subject", type: planned.mode,
        status: "completed", questions: snapshots, completedAt, lastActivityAt: completedAt, createdAt: completedAt,
        updatedAt: completedAt, expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      }, $setOnInsert: { _id: sessionId, userId } }, { upsert: true, runValidators: true });
      for (const [questionIndex, question] of snapshots.entries()) {
        const card = questions[questionIndex];
        const reviewedAt = question.answeredAt as Date;
        const result = question.correct === true ? "correct" : "wrong";
        const reviewId = stableId(`review:${sessionId.toHexString()}:${questionIndex}`);
        await ReviewRecord.updateOne({ _id: reviewId, userId }, { $set: {
          flashcardId: card._id, result, questionType: planned.mode, reviewedAt,
          nextReviewAt: new Date(reviewedAt.getTime() + (result === "correct" ? 3 : 1) * 86_400_000),
          quizSessionId: sessionId, questionIdentity: `demo-v1:${sessionId.toHexString().slice(-20)}:${questionIndex}`,
          quizQuestionIndex: questionIndex, quizRound: 1, achievementSubjectId: card.subjectId,
          achievementDayKey: dayKeys[planned.day], enumerationFullyCorrect: card.flashcardType === "items" && result === "correct",
          achievementEventsRecorded: true, createdAt: reviewedAt, updatedAt: reviewedAt,
        }, $setOnInsert: { _id: reviewId, userId } }, { upsert: true, runValidators: true });
      }
      // Completion and answer evidence match the app's compact, idempotent event ledger.
      const firstCorrect = snapshots.filter(q => q.correct === true).length;
      await AchievementEvent.updateOne({ userId, idempotencyKey: `quiz-completed:${sessionId}` }, { $setOnInsert: {
        userId, idempotencyKey: `quiz-completed:${sessionId}`, kind: "quiz-completed", occurredAt: completedAt,
        dayKey: dayKeys[planned.day], subjectId: subjectIds.get(planned.subject), originalQuestionCount: snapshots.length,
        firstAttemptCorrectCount: firstCorrect, scorePercent: firstCorrect * 100 / snapshots.length,
      } }, { upsert: true, runValidators: true });
      for (const [index, question] of snapshots.entries()) {
        const card = questions[index];
        await AchievementEvent.updateOne({ userId, idempotencyKey: `quiz-answer:${sessionId}:${index}` }, { $setOnInsert: {
          userId, idempotencyKey: `quiz-answer:${sessionId}:${index}`, kind: "quiz-answer", occurredAt: question.answeredAt as Date,
          dayKey: dayKeys[planned.day], subjectId: card.subjectId, sessionId, questionIdentity: `${sessionId}:${index}`,
          correct: question.correct === true, enumerationFullyCorrect: card.flashcardType === "items" && question.correct === true,
        } }, { upsert: true, runValidators: true });
      }
    }

    const mastery = await getSubjectMastery(userId);
    const reconciliation = await reconcileUserBadges(String(userId), { force: true, source: "backfill", now });
    const earned = await fetchEarnedBadges(String(userId));
    const featured = earned.slice(0, 3).map(badge => badge.badgeId);
    if (featured.length) {
      await updateFeaturedBadgeSelection(String(userId), "dashboard", featured);
      await updateFeaturedBadgeSelection(String(userId), "progress", featured);
    }
    const reviewRows = await ReviewRecord.find({ userId }).select("result reviewedAt").lean();
    const studyDays = [...new Set(reviewRows.map(row => studyDayKey(row.reviewedAt, "Asia/Manila")))].sort();
    const accuracy = reviewRows.length ? Math.round(reviewRows.filter(row => row.result === "correct").length * 100 / reviewRows.length) : 0;
    const activeSessions = await QuizSession.countDocuments({ userId, status: "completed", expiresAt: { $gt: now } });
    return {
      userId: String(userId), displayName: "User", emailVerified: true,
      counts: {
        subjects: subjectIds.size, subjectFolders: folderIds.size, topics: topicIds.size,
        topicFolders: [...topicFolderCounts.values()].reduce((sum, value) => sum + value, 0),
        flashcards: cards.length, standardFlashcards: cards.filter(card => card.flashcardType === "standard").length,
        enumerationFlashcards: cards.filter(card => card.flashcardType === "items").length,
        completedQuizSessions: activeSessions, reviewRecords: reviewRows.length, studyDays: studyDays.length, unlockedBadges: earned.length,
      },
      overallMastery: mastery.overall.progress,
      subjectMastery: Object.fromEntries(DEMO_SUBJECTS.map(subject => [subject.name, mastery.bySubject.get(String(subjectIds.get(subject.name)))?.progress ?? 0])),
      reviewAccuracy: accuracy,
      currentStreakDays: currentConsecutiveDayStreak(studyDays, studyDayKey(now, "Asia/Manila")),
      earnedBadges: earned.map(badge => badge.badgeId), newlyAwardedBadges: reconciliation.newlyAwardedBadgeIds,
    };
  } finally {
    await mongoose.disconnect();
    if (previousMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousMongoUri;
  }
}

export async function runDemoSeed(options: SeedOptions = {}) {
  const plan = makeDemoPlan();
  if (!options.apply && !options.refresh) {
    const target = validateTarget(options);
    return { dryRun: true, database: target.databaseName, environment: target.environment, plan };
  }
  if (options.refresh && !options.confirmedEmail) throw new Error("Refresh requires an explicit --confirm-email value.");
  return { dryRun: false, ...(await applyDemoSeed(options)) };
}

function parseArgs(args: string[]) {
  const allowed = new Set(["--apply", "--refresh", "--production-authorized"]);
  const unknown = args.filter(arg => !allowed.has(arg) && !arg.startsWith("--confirm-email="));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  if (args.includes("--apply") && args.includes("--refresh")) throw new Error("Use either --apply or --refresh, not both.");
  return {
    apply: args.includes("--apply") || args.includes("--refresh"), refresh: args.includes("--refresh"),
    productionAuthorized: args.includes("--production-authorized"),
    confirmedEmail: args.find(arg => arg.startsWith("--confirm-email="))?.slice("--confirm-email=".length),
  };
}

async function main() {
  const result = await runDemoSeed(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : "unknown error";
    const sanitized = [process.env.MONGODB_URI, process.env.ABII_DEMO_PASSWORD]
      .filter((secret): secret is string => Boolean(secret))
      .reduce((output, secret) => output.replaceAll(secret, "[redacted]"), message);
    console.error(`Demo seeding failed: ${sanitized}`);
    process.exitCode = 1;
  });
}
