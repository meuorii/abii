import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Flashcard } from "../models/Flashcard";
import { Subject } from "../models/Subject";
import { Topic } from "../models/Topic";
import { QuizSession } from "../models/QuizSession";
import { ReviewRecord } from "../models/ReviewRecord";
import { getEligibilityCounts, finishSession, loadSession, startSession, submitAnswer } from "../lib/quiz/service";
import { buildQuestionForCard, buildQuestions, isEligible, prepareCard } from "../lib/quiz/builder";
import { ENUM_MC_OPTION_COUNT } from "../lib/quiz/config";
import { normalizeText } from "../lib/quiz/normalize";
import type { QuizMode } from "../lib/quiz/types";

test("standard and enumeration formats remain compatible across quiz modes and topic scopes", async () => {
  const server = await MongoMemoryServer.create();
  try {
    process.env.MONGODB_URI = server.getUri("abii_quiz_compat_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const userId = new Types.ObjectId();
    const otherUserId = new Types.ObjectId();
    await mongoose.connection.db!.collection("users").insertMany([
      { _id: userId, name: "Quiz compatibility" },
      { _id: otherUserId, name: "Other user" },
    ]);
    const subject = await Subject.create({ userId, name: "Structures" });
    const otherSubject = await Subject.create({ userId, name: "Science" });
    const topic = await Topic.create({ userId, subjectId: subject._id, name: "Linear" });
    const siblingTopic = await Topic.create({ userId, subjectId: subject._id, name: "Other structures" });
    const otherSubjectTopic = await Topic.create({ userId, subjectId: otherSubject._id, name: "Planets" });
    const foreignSubject = await Subject.create({ userId: otherUserId, name: "Foreign" });
    const foreignTopic = await Topic.create({ userId: otherUserId, subjectId: foreignSubject._id, name: "Foreign topic" });
    const cards = await Flashcard.create([
      { userId, subjectId: subject._id, topicId: topic._id, flashcardType: "standard", question: "What does FIFO mean?", answer: "First In First Out" },
      { userId, subjectId: subject._id, topicId: topic._id, flashcardType: "items", question: "Name four linear structures", answer: "Array\nLinked List\nStack\nQueue" },
      { userId, subjectId: subject._id, topicId: siblingTopic._id, flashcardType: "items", question: "Name four colors", answer: "Red\nBlue\nGreen\nYellow" },
      { userId, subjectId: subject._id, topicId: siblingTopic._id, flashcardType: "standard", question: "What does LIFO mean?", answer: "Last In First Out" },
      { userId, subjectId: otherSubject._id, topicId: otherSubjectTopic._id, flashcardType: "items", question: "Name four planets", answer: "Mercury\nVenus\nEarth\nMars" },
      { userId: otherUserId, subjectId: foreignSubject._id, topicId: foreignTopic._id, flashcardType: "items", question: "Foreign list", answer: "Alpha\nBeta\nGamma\nDelta" },
    ]);
    const [standard, enumeration] = cards;
    const allPrepared = cards.filter((card) => String(card.userId) === String(userId)).map((card) => prepareCard({ ...card.toObject(), _id: card._id }));
    const standardCard = allPrepared.find((card) => card.id === String(standard._id))!;
    const enumerationCard = allPrepared.find((card) => card.id === String(enumeration._id))!;

    // Exercise fixed-mode compatibility, truthful eligibility, and Mixed/Random for each format.
    for (const mode of ["multiple-choice", "identification", "true-false", "random"] as const satisfies readonly QuizMode[]) {
      const standardQuestion = buildQuestionForCard(standardCard, allPrepared, mode);
      const enumerationQuestion = buildQuestionForCard(enumerationCard, allPrepared, mode);
      assert.ok(standardQuestion, `Standard should be eligible for ${mode}`);
      assert.ok(enumerationQuestion, `Enumeration should be eligible for ${mode}`);
      assert.equal(standardQuestion.type === "enumeration-identification" || standardQuestion.type === "enumeration-multiple-choice", false);
      if (mode !== "random") assert.equal(enumerationQuestion.type, mode === "multiple-choice" ? "enumeration-multiple-choice" : mode === "identification" ? "enumeration-identification" : "true-false");
      else assert.ok(["enumeration-multiple-choice", "enumeration-identification", "true-false"].includes(enumerationQuestion.type));
      if (mode === "multiple-choice") {
        assert.ok(standardQuestion.options.length >= 2);
        assert.ok(enumerationQuestion.options.length >= 2);
        assert.ok(enumerationQuestion.options.length <= ENUM_MC_OPTION_COUNT);
        const correctList = enumerationCard.items.map(normalizeText).sort();
        assert.deepEqual(enumerationQuestion.options[enumerationQuestion.correctIndex].split("\n").map(normalizeText).sort(), correctList);
        const normalizedOptions = enumerationQuestion.options.map((option) => option.split("\n").map(normalizeText).sort().join("\u0000"));
        assert.equal(new Set(normalizedOptions).size, normalizedOptions.length);
        for (const [index, option] of enumerationQuestion.options.entries()) {
          const items = option.split("\n");
          assert.equal(items.length, enumerationCard.items.length);
          assert.equal(new Set(items.map(normalizeText)).size, items.length);
          if (index !== enumerationQuestion.correctIndex) assert.notDeepEqual(items.map(normalizeText).sort(), correctList);
        }
      }
      if (mode === "identification") assert.equal(enumerationQuestion.type, "enumeration-identification");
      if (mode === "true-false") {
        assert.equal(enumerationQuestion.type, "true-false");
        assert.equal(enumerationQuestion.statement?.split("\n").length, enumerationCard.items.length);
        if (enumerationQuestion.truth) assert.deepEqual(enumerationQuestion.statement!.split("\n").map(normalizeText).sort(), enumerationCard.items.map(normalizeText).sort());
        else assert.notDeepEqual(enumerationQuestion.statement!.split("\n").map(normalizeText).sort(), enumerationCard.items.map(normalizeText).sort());
      }
    }

    const alone = [standardCard];
    assert.equal(isEligible(standardCard, "multiple-choice", alone), false);
    assert.equal(buildQuestions(alone, alone, "multiple-choice").length, 0);
    assert.equal(isEligible(enumerationCard, "multiple-choice", [enumerationCard]), false);
    assert.equal(buildQuestionForCard(enumerationCard, [enumerationCard], "multiple-choice"), null);
    const noAltEnumeration = buildQuestionForCard(enumerationCard, [enumerationCard], "true-false");
    assert.equal(noAltEnumeration?.type, "true-false");
    assert.equal(noAltEnumeration?.truth, true);

    const eligibility = await getEligibilityCounts(userId);
    assert.equal(eligibility.byTopic.get(String(topic._id))?.["multiple-choice"], 2);
    assert.equal(eligibility.byTopic.get(String(topic._id))?.identification, 2);
    assert.equal(eligibility.byTopic.get(String(topic._id))?.["true-false"], 2);

    // Start every selectable mode under all/subject/topic scopes; only source questions are scope-filtered.
    for (const scope of ["all", "subject", "topic"] as const) {
      for (const mode of ["multiple-choice", "identification", "true-false", "random"] as const satisfies readonly QuizMode[]) {
        const selectedCards = scope === "all"
          ? allPrepared
          : allPrepared.filter((card) => scope === "subject" ? card.subjectId === String(subject._id) : card.topicId === String(topic._id));
        const expectedEligible = buildQuestions(selectedCards, allPrepared, mode).length;
        const reportedEligible = scope === "all"
          ? eligibility.all[mode]
          : scope === "subject"
            ? eligibility.bySubject.get(String(subject._id))?.[mode] ?? 0
            : eligibility.byTopic.get(String(topic._id))?.[mode] ?? 0;
        assert.equal(reportedEligible, expectedEligible, `${scope}/${mode} eligibility count should match generated questions`);
        const result = await startSession(userId, { scope, ...(scope === "all" ? {} : { subjectId: String(subject._id) }), ...(scope === "topic" ? { topicId: String(topic._id) } : {}), type: mode });
        assert.equal(result.ok, true, `${scope}/${mode}: ${"message" in result ? result.message : ""}`);
        if (!result.ok) continue;
        const stored = await QuizSession.findById(result.sessionId).lean();
        assert.ok(stored);
        const scopedIds = scope === "topic"
          ? new Set(cards.filter((card) => String(card.topicId) === String(topic._id)).map((card) => String(card._id)))
          : scope === "subject"
            ? new Set(cards.filter((card) => String(card.subjectId) === String(subject._id)).map((card) => String(card._id)))
            : new Set(cards.filter((card) => String(card.userId) === String(userId)).map((card) => String(card._id)));
        assert.ok(stored.questions.length > 0);
        assert.ok(stored.questions.every((question) => scopedIds.has(String(question.flashcardId))), `${scope}/${mode} leaked a question outside its scope`);
        assert.ok(stored.questions.some((question) => String(question.flashcardId) === String(standard._id)));
        assert.ok(stored.questions.some((question) => String(question.flashcardId) === String(enumeration._id)));
        assert.equal(JSON.stringify(stored.questions).toLowerCase().includes("alpha"), false, "another user's answers must not enter the question pool");
        if (scope === "topic") assert.ok(stored.questions.some((question) => String(question.flashcardId) === String(enumeration._id)));
      }
    }

    // Enumeration grading is server-authoritative and reports partial item feedback.
    const enumSession = await startSession(userId, { scope: "topic", subjectId: String(subject._id), topicId: String(topic._id), type: "identification" });
    assert.equal(enumSession.ok, true);
    if (!enumSession.ok) return;
    let snapshot = await loadSession(userId, enumSession.sessionId);
    const enumIndex = snapshot!.questions.findIndex((question) => String(question.flashcardId) === String(enumeration._id));
    assert.equal(snapshot!.questions[enumIndex].type, "enumeration-identification");
    const partial = await submitAnswer(userId, enumSession.sessionId, { questionIndex: enumIndex, answers: ["Array", "wrong"] });
    assert.equal(partial.ok, true);
    if (partial.ok) {
      assert.equal(partial.result.correct, false);
      assert.deepEqual(partial.result.itemCorrect, [true, false]);
      assert.ok(partial.result.missingItems?.length);
    }

    const correctEnumSession = await startSession(userId, { scope: "topic", subjectId: String(subject._id), topicId: String(topic._id), type: "identification" });
    assert.equal(correctEnumSession.ok, true);
    if (!correctEnumSession.ok) return;
    snapshot = await loadSession(userId, correctEnumSession.sessionId);
    const correctEnumIndex = snapshot!.questions.findIndex((question) => String(question.flashcardId) === String(enumeration._id));
    const correctEnum = await submitAnswer(userId, correctEnumSession.sessionId, { questionIndex: correctEnumIndex, answers: [...enumerationCard.items].reverse() });
    assert.equal(correctEnum.ok, true);
    if (correctEnum.ok) assert.equal(correctEnum.result.correct, true);

    const mcSession = await startSession(userId, { scope: "topic", subjectId: String(subject._id), topicId: String(topic._id), type: "multiple-choice" });
    assert.equal(mcSession.ok, true);
    if (!mcSession.ok) return;
    snapshot = await loadSession(userId, mcSession.sessionId);
    for (const cardId of [standard._id, enumeration._id]) {
      const index = snapshot!.questions.findIndex((question) => String(question.flashcardId) === String(cardId));
      const question = snapshot!.questions[index];
      assert.ok(question.type === "multiple-choice" || question.type === "enumeration-multiple-choice");
      const graded = await submitAnswer(userId, mcSession.sessionId, { questionIndex: index, selectedIndex: question.correctIndex });
      assert.equal(graded.ok, true);
      if (graded.ok) assert.equal(graded.result.correct, true);
    }

    const trueFalseSession = await startSession(userId, { scope: "topic", subjectId: String(subject._id), topicId: String(topic._id), type: "true-false" });
    assert.equal(trueFalseSession.ok, true);
    if (!trueFalseSession.ok) return;
    snapshot = await loadSession(userId, trueFalseSession.sessionId);
    const tfIndex = snapshot!.questions.findIndex((question) => String(question.flashcardId) === String(enumeration._id));
    const tfQuestion = snapshot!.questions[tfIndex];
    assert.equal(tfQuestion.type, "true-false");
    const tfResult = await submitAnswer(userId, trueFalseSession.sessionId, { questionIndex: tfIndex, truth: !tfQuestion.truth });
    assert.equal(tfResult.ok, true);
    if (tfResult.ok) assert.equal(tfResult.result.correct, false);
    const savedModes = await ReviewRecord.find({ userId, flashcardId: enumeration._id }).select("questionType result").lean();
    assert.ok(savedModes.some((record) => record.questionType === "identification" && record.result === "wrong"));
    assert.ok(savedModes.some((record) => record.questionType === "identification" && record.result === "correct"));
    assert.ok(savedModes.some((record) => record.questionType === "multiple-choice" && record.result === "correct"));
    assert.ok(savedModes.some((record) => record.questionType === "true-false" && record.result === "wrong"));

    const standardIdSession = await startSession(userId, { scope: "topic", subjectId: String(subject._id), topicId: String(topic._id), type: "identification" });
    assert.equal(standardIdSession.ok, true);
    if (!standardIdSession.ok) return;
    snapshot = await loadSession(userId, standardIdSession.sessionId);
    const standardIdIndex = snapshot!.questions.findIndex((question) => String(question.flashcardId) === String(standard._id));
    const standardIdResult = await submitAnswer(userId, standardIdSession.sessionId, { questionIndex: standardIdIndex, answer: standard.answer });
    assert.equal(standardIdResult.ok, true);
    if (standardIdResult.ok) assert.equal(standardIdResult.result.correct, true);

    const standardTfSession = await startSession(userId, { scope: "topic", subjectId: String(subject._id), topicId: String(topic._id), type: "true-false" });
    assert.equal(standardTfSession.ok, true);
    if (!standardTfSession.ok) return;
    snapshot = await loadSession(userId, standardTfSession.sessionId);
    const standardTfIndex = snapshot!.questions.findIndex((question) => String(question.flashcardId) === String(standard._id));
    const standardTfResult = await submitAnswer(userId, standardTfSession.sessionId, { questionIndex: standardTfIndex, truth: Boolean(snapshot!.questions[standardTfIndex].truth) });
    assert.equal(standardTfResult.ok, true);
    if (standardTfResult.ok) assert.equal(standardTfResult.result.correct, true);

    const randomSession = await startSession(userId, { scope: "topic", subjectId: String(subject._id), topicId: String(topic._id), type: "random" });
    assert.equal(randomSession.ok, true);
    if (!randomSession.ok) return;
    snapshot = await loadSession(userId, randomSession.sessionId);
    const randomIndex = snapshot!.questions.findIndex((question) => String(question.flashcardId) === String(enumeration._id));
    const randomQuestion = snapshot!.questions[randomIndex];
    const randomInput = randomQuestion.type === "enumeration-identification"
      ? { questionIndex: randomIndex, answers: [...(randomQuestion.expectedItems ?? [])] }
      : randomQuestion.type === "enumeration-multiple-choice" || randomQuestion.type === "multiple-choice"
        ? { questionIndex: randomIndex, selectedIndex: randomQuestion.correctIndex }
        : randomQuestion.type === "identification"
          ? { questionIndex: randomIndex, answer: randomQuestion.expectedAnswer }
          : { questionIndex: randomIndex, truth: Boolean(randomQuestion.truth) };
    const randomResult = await submitAnswer(userId, randomSession.sessionId, randomInput);
    assert.equal(randomResult.ok, true);
    if (randomResult.ok) assert.equal(randomResult.result.correct, true);
    assert.ok((await ReviewRecord.find({ userId, flashcardId: enumeration._id }).distinct("questionType")).includes("random"));

    // Retry rounds retain only the cards originally selected for that topic.
    const retrySession = await startSession(userId, { scope: "topic", subjectId: String(subject._id), topicId: String(topic._id), type: "identification" });
    assert.equal(retrySession.ok, true);
    if (!retrySession.ok) return;
    snapshot = await loadSession(userId, retrySession.sessionId);
    for (let index = 0; index < snapshot!.questions.length; index++) {
      const question = snapshot!.questions[index];
      await submitAnswer(userId, retrySession.sessionId, question.type === "enumeration-identification"
        ? { questionIndex: index, answers: ["incorrect"] }
        : { questionIndex: index, answer: "incorrect" });
    }
    const retry = await finishSession(userId, retrySession.sessionId);
    assert.equal(retry.ok, true);
    if (retry.ok) {
      assert.equal(retry.done, false);
      assert.equal(retry.session.scope, "topic");
      assert.equal(retry.session.topicId, String(topic._id));
      const retriedStored = await loadSession(userId, retrySession.sessionId);
      assert.ok(retriedStored!.questions.every((question) => String(question.flashcardId) === String(standard._id) || String(question.flashcardId) === String(enumeration._id)));
    }
  } finally {
    await mongoose.disconnect();
    await server.stop();
    delete process.env.MONGODB_URI;
  }
});
