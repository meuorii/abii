import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getSubjectMastery } from "../lib/quiz/service";
import { Flashcard } from "../models/Flashcard";
import { ReviewRecord } from "../models/ReviewRecord";
import { Subject } from "../models/Subject";
import { Topic } from "../models/Topic";
import { QUIZ_MODES } from "../lib/quiz/types";

test("streak mastery aggregates consistently by topic, subject, type, and account", async () => {
  const server = await MongoMemoryServer.create();
  try {
    process.env.MONGODB_URI = server.getUri("abii_mastery_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const userId = new Types.ObjectId();
    await mongoose.connection.db!.collection("users").insertOne({ _id: userId, name: "Mastery test" });
    const subject = await Subject.create({ userId, name: "Algorithms" });
    const topicA = await Topic.create({ userId, subjectId: subject._id, name: "Arrays" });
    const topicB = await Topic.create({ userId, subjectId: subject._id, name: "Lists" });
    const emptyTopic = await Topic.create({ userId, subjectId: subject._id, name: "Empty" });
    const cards = await Flashcard.create([
      { userId, subjectId: subject._id, topicId: topicA._id, flashcardType: "standard", question: "Q alpha", answer: "alpha" },
      { userId, subjectId: subject._id, topicId: topicA._id, flashcardType: "standard", question: "Q beta", answer: "beta" },
      { userId, subjectId: subject._id, topicId: topicB._id, flashcardType: "items", question: "Q list", answer: "red\nblue" },
      { userId, subjectId: subject._id, topicId: topicB._id, flashcardType: "standard", question: "Q gamma", answer: "gamma" },
    ]);
    const [mastered, wrongStreak, enumeration] = cards;
    const rows: Array<{ card: typeof mastered; mode: (typeof QUIZ_MODES)[number]; result: "correct" | "wrong"; date: Date }> = [];
    for (const mode of QUIZ_MODES) for (let i = 0; i < 3; i++) rows.push({ card: mastered, mode, result: "correct", date: new Date(Date.UTC(2025, 0, i + 1)) });
    rows.push({ card: wrongStreak, mode: "identification", result: "correct", date: new Date("2025-02-01") });
    rows.push({ card: wrongStreak, mode: "identification", result: "correct", date: new Date("2025-02-02") });
    rows.push({ card: wrongStreak, mode: "identification", result: "wrong", date: new Date("2025-02-03") });
    for (let i = 0; i < 3; i++) rows.push({ card: enumeration, mode: "identification", result: "correct", date: new Date(Date.UTC(2025, 2, i + 1)) });
    await ReviewRecord.create(rows.map(({ card, mode, result, date }) => ({ userId, flashcardId: card._id, questionType: mode, result, reviewedAt: date, nextReviewAt: new Date("2020-01-01") })));

    const initial = await getSubjectMastery(userId);
    const subjectStats = initial.bySubject.get(String(subject._id))!;
    assert.equal(initial.overall.total, 4);
    assert.equal(initial.overall.usable, 4);
    assert.equal(subjectStats.mastered, 1);
    assert.equal(subjectStats.completedRequirements, 5);
    assert.equal(subjectStats.totalRequirements, 16);
    assert.equal(subjectStats.progress, 31);
    assert.equal(initial.byTopic.get(String(topicA._id))!.total, 2);
    assert.equal(initial.byTopic.get(String(topicA._id))!.mastered, 1);
    assert.equal(initial.byTopic.get(String(topicA._id))!.completedRequirements, 4);
    assert.equal(initial.byTopic.get(String(topicA._id))!.totalRequirements, 8);
    assert.equal(initial.byTopic.get(String(topicA._id))!.progress, 50);
    assert.equal(initial.byTopic.get(String(topicB._id))!.total, 2);
    assert.equal(initial.byTopic.get(String(topicB._id))!.mastered, 0);
    assert.equal(initial.byTopic.get(String(topicB._id))!.completedRequirements, 1);
    assert.equal(initial.byTopic.get(String(topicB._id))!.totalRequirements, 8);
    assert.equal(initial.byTopic.get(String(topicB._id))!.progress, 13);
    assert.equal(initial.byTopic.get(String(emptyTopic._id))!.progress, 0);
    assert.equal(initial.overall.completedRequirements, 5);
    assert.equal(initial.overall.totalRequirements, 16);
    assert.equal(initial.byTopic.get(String(topicA._id))!.totalRequirements + initial.byTopic.get(String(topicB._id))!.totalRequirements, subjectStats.totalRequirements);
    assert.equal([...initial.bySubject.values()].reduce((sum, value) => sum + value.completedRequirements, 0), initial.overall.completedRequirements);
    assert.equal(initial.byTypeBySubject.get(String(subject._id))!.identification.done, 2);
    assert.equal(initial.byTypeBySubject.get(String(subject._id))!.identification.total, 4);
    assert.equal(initial.byTypeByTopic.get(String(topicA._id))!.identification.done, 1);
    assert.equal(initial.byTypeByTopic.get(String(topicB._id))!.random.total, 2);
    assert.equal([...initial.byTopic.values()].reduce((sum, value) => sum + value.total, 0), subjectStats.total);
    assert.equal([...initial.bySubject.values()].reduce((sum, value) => sum + value.total, 0), initial.overall.total);

    // Adding fresh streaks one mode at a time increases requirement completion
    // while the card remains partially mastered until its fourth applicable mode.
    for (let modeIndex = 0; modeIndex < QUIZ_MODES.length; modeIndex++) {
      const mode = QUIZ_MODES[modeIndex];
      await ReviewRecord.create(Array.from({ length: 3 }, (_, attempt) => ({
        userId,
        flashcardId: wrongStreak._id,
        questionType: mode,
        result: "correct",
        reviewedAt: new Date(Date.UTC(2025, 3, modeIndex * 3 + attempt + 1)),
        nextReviewAt: new Date("2020-01-01"),
      })));
      const partial = await getSubjectMastery(userId);
      assert.equal(partial.overall.completedRequirements, 5 + modeIndex + 1);
      assert.equal(partial.overall.mastered, modeIndex === QUIZ_MODES.length - 1 ? 2 : 1);
    }
    await ReviewRecord.deleteMany({ userId, flashcardId: wrongStreak._id });

    await Flashcard.updateOne({ _id: mastered._id }, { $set: { topicId: topicB._id } });
    const moved = await getSubjectMastery(userId);
    assert.equal(moved.byTopic.get(String(topicA._id))!.total, 1);
    assert.equal(moved.byTopic.get(String(topicB._id))!.total, 3);
    assert.equal(moved.byTopic.get(String(topicA._id))!.totalRequirements, 4);
    assert.equal(moved.byTopic.get(String(topicB._id))!.totalRequirements, 12);
    assert.equal(moved.byTopic.get(String(topicA._id))!.totalRequirements + moved.byTopic.get(String(topicB._id))!.totalRequirements, 16);
    assert.equal(moved.byTopic.get(String(topicA._id))!.mastered, 0);
    assert.equal(moved.byTopic.get(String(topicB._id))!.mastered, 1);
    assert.equal(moved.byTopic.get(String(topicA._id))!.totalRequirements + moved.byTopic.get(String(topicB._id))!.totalRequirements, moved.bySubject.get(String(subject._id))!.totalRequirements);
    assert.equal(moved.bySubject.get(String(subject._id))!.mastered, 1);
    assert.equal(moved.overall.mastered, 1);

    await ReviewRecord.deleteMany({ userId, flashcardId: mastered._id }); // substantive content edits clear study streak records
    const reset = await getSubjectMastery(userId);
    assert.equal(reset.byTopic.get(String(topicB._id))!.mastered, 0);
    assert.equal(reset.overall.mastered, 0);
    await ReviewRecord.deleteMany({ userId, flashcardId: wrongStreak._id });
    await ReviewRecord.deleteMany({ userId, flashcardId: enumeration._id });
    await Flashcard.deleteOne({ _id: mastered._id });
    const deleted = await getSubjectMastery(userId);
    assert.equal(deleted.overall.total, 3);
    assert.equal(deleted.bySubject.get(String(subject._id))!.total, 3);
    assert.equal(deleted.overall.mastered, 0);
  } finally {
    await mongoose.disconnect();
    await server.stop();
    delete process.env.MONGODB_URI;
  }
});

