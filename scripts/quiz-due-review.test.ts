import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Flashcard } from "../models/Flashcard";
import { QuizSession } from "../models/QuizSession";
import { ReviewRecord } from "../models/ReviewRecord";
import { Subject } from "../models/Subject";
import { Topic } from "../models/Topic";
import { getDueCards, getEligibilityCounts, startSession } from "../lib/quiz/service";
import { prepareCard } from "../lib/quiz/builder";

test("due review uses the latest owner-scoped schedule and a controlled instant", { timeout: 60_000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    process.env.MONGODB_URI = mongo.getUri("abii_due_review_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const userId = new Types.ObjectId();
    const otherUserId = new Types.ObjectId();
    const subject = await Subject.create({ userId, name: "Recall" });
    const otherSubject = await Subject.create({ userId: otherUserId, name: "Other" });
    const cards = await Flashcard.create([
      { userId, subjectId: subject._id, question: "Never reviewed?", answer: "yes" },
      { userId, subjectId: subject._id, question: "Due now?", answer: "yes" },
      { userId, subjectId: subject._id, question: "Future?", answer: "yes" },
      { userId, subjectId: subject._id, question: "Distractor", answer: "different" },
      { userId, subjectId: subject._id, question: "Ineligible long answer?", answer: "x".repeat(121) },
      { userId: otherUserId, subjectId: otherSubject._id, question: "Foreign?", answer: "no" },
    ]);
    const instant = new Date("2026-11-13T12:00:00.000Z");
    await ReviewRecord.create([
      { userId, flashcardId: cards[1]._id, questionType: "identification", result: "correct", reviewedAt: new Date(instant.getTime() - 10_000), nextReviewAt: instant },
      { userId, flashcardId: cards[2]._id, questionType: "identification", result: "correct", reviewedAt: new Date(instant.getTime() - 20_000), nextReviewAt: new Date(instant.getTime() + 1) },
      { userId, flashcardId: cards[2]._id, questionType: "true-false", result: "wrong", reviewedAt: new Date(instant.getTime() - 1_000), nextReviewAt: new Date(instant.getTime() + 60_000) },
      { userId: otherUserId, flashcardId: cards[4]._id, questionType: "identification", result: "correct", reviewedAt: instant, nextReviewAt: new Date(instant.getTime() + 60_000) },
    ]);
    const prepared = cards.filter((card) => String(card.userId) === String(userId)).map((card) => prepareCard({ ...card.toObject(), _id: card._id }));
    const due = await getDueCards(userId, prepared, instant);
    assert.deepEqual(new Set(due.map((card) => card.id)), new Set([String(cards[0]._id), String(cards[1]._id), String(cards[3]._id), String(cards[4]._id)]));
    const counts = await getEligibilityCounts(userId, { filter: "due", now: instant });
    assert.equal(counts.dueCardCount, 4, "due candidates include cards that may not support a quiz mode");
    assert.equal(counts.all.identification, 3);
    assert.equal(counts.all["multiple-choice"], 3, "the full owned library remains available to build distractors");
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
    delete process.env.MONGODB_URI;
  }
});

test("due-only session creation filters questions but retains the original intent", { timeout: 60_000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    process.env.MONGODB_URI = mongo.getUri("abii_due_session_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const userId = new Types.ObjectId();
    const subject = await Subject.create({ userId, name: "Recall" });
    const topic = await Topic.create({ userId, subjectId: subject._id, name: "Due topic" });
    const cards = await Flashcard.create([
      { userId, subjectId: subject._id, topicId: topic._id, question: "Due prompt", answer: "Due answer" },
      { userId, subjectId: subject._id, topicId: topic._id, question: "Future prompt", answer: "Future answer" },
      { userId, subjectId: subject._id, topicId: topic._id, question: "Safe distractor", answer: "Other answer" },
    ]);
    const now = new Date();
    await ReviewRecord.create([
      { userId, flashcardId: cards[1]._id, questionType: "identification", result: "correct", reviewedAt: new Date(now.getTime() - 60_000), nextReviewAt: new Date(now.getTime() + 86_400_000) },
      { userId, flashcardId: cards[2]._id, questionType: "identification", result: "correct", reviewedAt: new Date(now.getTime() - 30_000), nextReviewAt: new Date(now.getTime() + 86_400_000) },
    ]);
    const result = await startSession(userId, { scope: "topic", subjectId: String(subject._id), topicId: String(topic._id), reviewFilter: "due", type: "identification" });
    assert.ok(result.ok, "a never-reviewed card should be selectable");
    if (result.ok) {
      const session = await QuizSession.findById(result.sessionId).lean();
      assert.deepEqual(session?.questions.map((question) => String(question.flashcardId)), [String(cards[0]._id)]);
      assert.equal(session?.scope, "topic");
      assert.equal(String(session?.topicId), String(topic._id));
      assert.equal(session?.reviewFilter, "due");
    }
    assert.deepEqual(await startSession(userId, { scope: "all", reviewFilter: "unexpected", type: "identification" }), { ok: false, status: 400, message: "Choose a valid review filter." });
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
    delete process.env.MONGODB_URI;
  }
});
