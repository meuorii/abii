import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../models/User";
import { Subject } from "../models/Subject";
import { SubjectFolder } from "../models/SubjectFolder";
import { Folder } from "../models/Folder";
import { Topic } from "../models/Topic";
import { Flashcard } from "../models/Flashcard";
import { QuizSession } from "../models/QuizSession";
import { ReviewRecord } from "../models/ReviewRecord";
import { UserBadge } from "../models/UserBadge";
import { BADGE_BY_ID } from "../lib/badges/catalog";
import { getSubjectMastery } from "../lib/quiz/service";
import { isUsableCard, prepareCard } from "../lib/quiz/builder";
import { applyDemoSeed, DEMO_SEED_KEY, runDemoSeed } from "./seed-demo-account";
import { validateDemoDataset } from "./demo-seed-data";

const testNow = new Date("2026-11-11T05:00:00.000Z");

test("demo seed data and dry run validate without database writes", async () => {
  assert.deepEqual(validateDemoDataset(), { subjects: 5, topics: 20, cards: 90, enumerationCards: 22 });
  const result = await runDemoSeed({ env: {
    MONGODB_URI: "mongodb://127.0.0.1:27017/abii_demo_dry_run", ABII_DEMO_EMAIL: "demo@example.invalid",
    ABII_DEMO_PASSWORD: "private-demo-password", ABII_DEMO_SEED_ENV: "test",
  } });
  assert.equal(result.dryRun, true);
  assert.equal(result.plan?.cards, 90);
  assert.equal(mongoose.connection.readyState, 0, "dry run does not connect to MongoDB");
});

test("MongoDB URI validation accepts SRV and multi-host forms and protects production targets", async () => {
  const credentials = { ABII_DEMO_EMAIL: "demo-uri@example.invalid", ABII_DEMO_PASSWORD: "private-demo-password", ABII_DEMO_SEED_ENV: "test" };
  const supportedUris = [
    "mongodb+srv://demo-user:private-password@cluster0.example.mongodb.net/abii_demo_dev?retryWrites=true&w=majority",
    "mongodb://demo-user:private-password@mongo-a.example.net:27017,mongo-b.example.net:27017/abii_demo_dev?replicaSet=rs0",
  ];
  for (const MONGODB_URI of supportedUris) {
    const driver = new mongoose.mongo.MongoClient(MONGODB_URI);
    await driver.close();
    const result = await runDemoSeed({ env: { ...credentials, MONGODB_URI } });
    assert.equal(result.dryRun, true);
    assert.equal(result.database, "abii_demo_dev");
    assert.equal(mongoose.connection.readyState, 0, "URI dry runs never connect or write");
  }

  await assert.rejects(() => runDemoSeed({ env: { ...credentials, MONGODB_URI: "mongodb://demo-user:private-password@localhost:27017" } }), /must name a database/);
  await assert.rejects(() => runDemoSeed({ env: { ...credentials, MONGODB_URI: "this is not a MongoDB connection string" } }), /valid MongoDB connection URI/);
  await assert.rejects(() => applyDemoSeed({ env: {
    ...credentials,
    ABII_DEMO_SEED_ENV: "development",
    MONGODB_URI: "mongodb+srv://demo-user:private-password@cluster-production.example.mongodb.net/abii_demo_dev",
  } }), /Production-looking writes/);
  assert.equal(mongoose.connection.readyState, 0, "protected production-like targets are rejected before connecting");
});

test("demo apply is authentic, repeatable, owner-scoped, and badge backed", { timeout: 120_000 }, async () => {
  const server = await MongoMemoryServer.create();
  const email = "abii-demo-seed@example.invalid";
  const env = { MONGODB_URI: server.getUri("abii_demo_seed_test"), ABII_DEMO_EMAIL: email, ABII_DEMO_PASSWORD: "private-demo-password", ABII_DEMO_SEED_ENV: "test" };
  try {
    await mongoose.connect(env.MONGODB_URI, { dbName: "abii_demo_seed_test", autoIndex: false });
    const ordinary = await User.create({ name: "Keep Me", email: "ordinary-seed@example.invalid", passwordHash: "existing-hash" });
    const ordinarySubject = await Subject.create({ userId: ordinary._id, name: "Private Subject" });
    await mongoose.disconnect();
    const dryRun = await runDemoSeed({ env, now: testNow });
    assert.equal(dryRun.dryRun, true);
    await mongoose.connect(env.MONGODB_URI, { dbName: "abii_demo_seed_test", autoIndex: false });
    assert.equal(await User.countDocuments(), 1, "dry run must not write an account");
    await mongoose.disconnect();

    const first = await applyDemoSeed({ env, now: testNow });
    assert.equal(first.displayName, "User");
    assert.equal(first.emailVerified, true);
    assert.equal(first.counts.subjects, 5);
    assert.equal(first.counts.subjectFolders, 3);
    assert.equal(first.counts.topics, 20);
    assert.equal(first.counts.topicFolders, 15);
    assert.equal(first.counts.flashcards, 90);
    assert.equal(first.counts.standardFlashcards, 68);
    assert.equal(first.counts.enumerationFlashcards, 22);
    assert.equal(first.counts.completedQuizSessions, 20);
    assert.equal(first.counts.studyDays, 7);
    assert.ok(first.overallMastery > 0);
    assert.ok(first.subjectMastery.Biology >= 25);
    assert.ok(first.reviewAccuracy >= 50 && first.reviewAccuracy < 100);
    assert.ok(first.currentStreakDays >= 7);

    await mongoose.connect(env.MONGODB_URI, { dbName: "abii_demo_seed_test", autoIndex: false });
    const demo = await User.findOne({ email }).select("+passwordHash +demoSeedKey").lean();
    assert.ok(demo);
    assert.equal(demo.name, "User");
    assert.equal(demo.demoSeedKey, DEMO_SEED_KEY);
    assert.ok(demo.emailVerifiedAt instanceof Date);
    assert.equal(demo.settings.studyTimezone, "Asia/Manila");
    assert.equal(await bcrypt.compare(env.ABII_DEMO_PASSWORD, demo.passwordHash), true);
    assert.equal(await Subject.countDocuments({ userId: demo._id }), 5);
    assert.equal(await SubjectFolder.countDocuments({ userId: demo._id }), 3);
    assert.equal(await Folder.countDocuments({ userId: demo._id }), 15);
    assert.equal(await Topic.countDocuments({ userId: demo._id }), 20);
    assert.equal(await Flashcard.countDocuments({ userId: demo._id }), 90);
    assert.equal(await Subject.countDocuments({ userId: ordinary._id }), 1);
    const subjects = await Subject.find({ userId: demo._id }).lean();
    const subjectFolders = await SubjectFolder.find({ userId: demo._id }).lean();
    const folders = await Folder.find({ userId: demo._id }).lean();
    const topics = await Topic.find({ userId: demo._id }).lean();
    const cards = await Flashcard.find({ userId: demo._id }).lean();
    const subjectById = new Map(subjects.map(subject => [String(subject._id), subject]));
    const folderById = new Map(folders.map(folder => [String(folder._id), folder]));
    const topicById = new Map(topics.map(topic => [String(topic._id), topic]));
    const cardById = new Map(cards.map(card => [String(card._id), card]));
    assert.ok(subjects.every(subject => subjectFolders.some(folder => String(folder._id) === String(subject.subjectFolderId) && String(folder.userId) === String(demo._id))));
    assert.ok(topics.every(topic => subjectById.has(String(topic.subjectId)) && folderById.get(String(topic.folderId))?.subjectId.equals(topic.subjectId)));
    assert.ok(cards.every(card => topicById.get(String(card.topicId))?.subjectId.equals(card.subjectId) && isUsableCard(prepareCard(card))));
    assert.equal(cards.filter(card => card.flashcardType === "items").length, 22);
    const initialPasswordHash = demo.passwordHash;
    const sessions = await QuizSession.find({ userId: demo._id }).lean();
    assert.equal(sessions.filter(session => session.status === "completed").length, 20);
    assert.ok(sessions.every(session => session.questions.length === 8 && session.questions.every(question => question.answered && typeof question.correct === "boolean")));
    assert.ok(sessions.every(session => session.expiresAt.getTime() > testNow.getTime() && session.expiresAt.getTime() <= testNow.getTime() + 24 * 60 * 60 * 1000));
    const reviews = await ReviewRecord.find({ userId: demo._id }).lean();
    assert.equal(reviews.length, 160);
    assert.ok(reviews.every(review => review.quizSessionId && review.achievementEventsRecorded));
    for (const session of sessions) for (const [index, question] of session.questions.entries()) {
      assert.ok(cardById.has(String(question.flashcardId)));
      const review = reviews.find(row => String(row.quizSessionId) === String(session._id) && row.quizQuestionIndex === index);
      assert.ok(review, "every answered question has one persisted review record");
      assert.equal(review?.result, question.correct ? "correct" : "wrong");
      assert.equal(review?.questionType, session.type);
    }
    const masteries = await getSubjectMastery(String(demo._id));
    assert.equal(masteries.bySubject.size, 5);
    assert.ok(masteries.overall.progress > 0);
    const unlocked = await UserBadge.find({ userId: demo._id }).lean();
    const names = unlocked.map(record => BADGE_BY_ID[record.badgeId as keyof typeof BADGE_BY_ID].name);
    for (const expected of ["Hello, Abii!", "Card Creator", "Little Explorer", "Quiz Rookie", "Getting Into Rhythm", "Weekly Wonder", "Growing Knowledge"]) assert.ok(names.includes(expected), `expected earned badge ${expected}`);
    assert.ok(unlocked.length < Object.keys(BADGE_BY_ID).length, "some badges remain locked");
    assert.equal(await User.countDocuments(), 2);
    assert.equal((await User.findById(ordinary._id).lean())?.name, "Keep Me");
    await mongoose.disconnect();

    const second = await applyDemoSeed({ env, now: testNow });
    assert.equal(second.counts.reviewRecords, first.counts.reviewRecords);
    assert.equal(second.counts.unlockedBadges, first.counts.unlockedBadges);
    await mongoose.connect(env.MONGODB_URI, { dbName: "abii_demo_seed_test", autoIndex: false });
    assert.equal(await User.countDocuments(), 2);
    assert.equal(await Subject.countDocuments({ userId: demo._id }), 5);
    assert.equal(await Flashcard.countDocuments({ userId: demo._id }), 90);
    assert.equal(await QuizSession.countDocuments({ userId: demo._id }), 20);
    assert.equal(await ReviewRecord.countDocuments({ userId: demo._id }), 160);
    assert.equal(await UserBadge.countDocuments({ userId: demo._id }), unlocked.length);
    assert.equal((await User.findById(demo._id).select("+passwordHash").lean())?.passwordHash, initialPasswordHash, "reruns preserve the existing password hash");
    assert.equal(await Subject.countDocuments({ userId: ordinary._id, _id: ordinarySubject._id }), 1);
    await mongoose.disconnect();

    const refreshed = await applyDemoSeed({ env, refresh: true, confirmedEmail: email, now: testNow });
    assert.equal(refreshed.counts.completedQuizSessions, 20);
    assert.equal(refreshed.counts.reviewRecords, first.counts.reviewRecords);

    await assert.rejects(() => applyDemoSeed({ env: { ...env, ABII_DEMO_EMAIL: "ordinary-seed@example.invalid" }, now: testNow }), /without the demo ownership marker/);
    await assert.rejects(() => applyDemoSeed({ env, refresh: true, confirmedEmail: "wrong@example.invalid", now: testNow }), /exactly match/);
    await assert.rejects(() => applyDemoSeed({ env: { ...env, ABII_DEMO_SEED_ENV: "production", MONGODB_URI: "mongodb://localhost/abii_prod" }, now: testNow }), /Production-looking writes/);
  } finally {
    if (mongoose.connection.readyState) await mongoose.disconnect();
    await server.stop();
  }
});
