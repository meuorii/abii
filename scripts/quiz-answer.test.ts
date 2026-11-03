import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { submitAnswer } from "../lib/quiz/service";
import { retryPendingAchievementEvents } from "../lib/badges/reconcile";
import { AchievementEvent } from "../models/AchievementEvent";
import { Flashcard } from "../models/Flashcard";
import { QuizSession } from "../models/QuizSession";
import { ReviewRecord } from "../models/ReviewRecord";
import { Subject } from "../models/Subject";
import { User } from "../models/User";

test("concurrent duplicate answers persist one review and wrong answers reset mastery", { timeout: 60000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    process.env.MONGODB_URI = mongo.getUri("abii_quiz_answer_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.create({ name: "Quiz test", email: "quiz@example.invalid", passwordHash: "hash" });
    const subject = await Subject.create({ userId: user._id, name: "Recall" });
    const card = await Flashcard.create({ userId: user._id, subjectId: subject._id, question: "Prompt", answer: "target" });
    const session = await QuizSession.create({
      userId: user._id,
      subjectId: subject._id,
      subjectName: subject.name,
      type: "identification",
      status: "active",
      expiresAt: new Date(Date.now() + 86_400_000),
      questions: [{ flashcardId: card._id, prompt: "Prompt", expectedAnswer: "target", answered: false }],
    });

    const submissions = await Promise.all([
      submitAnswer(user._id, String(session._id), { questionIndex: 0, answer: "target" }),
      submitAnswer(user._id, String(session._id), { questionIndex: 0, answer: "target" }),
    ]);
    assert.ok(submissions.every((submission) => submission.ok));
    assert.equal(submissions.filter((submission) => submission.ok && !submission.duplicate).length, 1);
    assert.equal(await ReviewRecord.countDocuments({ userId: user._id, flashcardId: card._id }), 1);
    assert.equal(await AchievementEvent.countDocuments({ userId: user._id, idempotencyKey: `quiz-answer:${String(session._id)}:0` }), 1);
    await AchievementEvent.deleteOne({ userId: user._id, idempotencyKey: `quiz-answer:${String(session._id)}:0` });
    await ReviewRecord.updateOne({ userId: user._id, quizSessionId: session._id, quizQuestionIndex: 0 }, { $set: { achievementEventsRecorded: false } });
    await retryPendingAchievementEvents(user._id);
    assert.equal(await AchievementEvent.countDocuments({ userId: user._id, idempotencyKey: `quiz-answer:${String(session._id)}:0` }), 1);
    assert.equal((await ReviewRecord.findOne({ userId: user._id, quizSessionId: session._id, quizQuestionIndex: 0 }).lean())?.achievementEventsRecorded, true);

    await ReviewRecord.create([
      { userId: user._id, flashcardId: card._id, questionType: "identification", result: "correct", reviewedAt: new Date(Date.now() - 2000), nextReviewAt: new Date() },
      { userId: user._id, flashcardId: card._id, questionType: "identification", result: "correct", reviewedAt: new Date(Date.now() - 1000), nextReviewAt: new Date() },
    ]);
    const wrongSession = await QuizSession.create({
      userId: user._id,
      subjectId: subject._id,
      subjectName: subject.name,
      type: "identification",
      status: "active",
      expiresAt: new Date(Date.now() + 86_400_000),
      questions: [{ flashcardId: card._id, prompt: "Prompt", expectedAnswer: "target", answered: false }],
    });
    const wrong = await submitAnswer(user._id, String(wrongSession._id), { questionIndex: 0, answer: "incorrect" });
    assert.ok(wrong.ok);
    if (wrong.ok) {
      assert.equal(wrong.result.correct, false);
      assert.equal(wrong.mastery[0], 0);
    }
    assert.equal(await ReviewRecord.countDocuments({ userId: user._id, flashcardId: card._id, result: "wrong" }), 1);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
    delete process.env.MONGODB_URI;
  }
});
