import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Topic, normalizeTopicName, isDuplicateTopicError } from "../models/Topic";
import { Flashcard } from "../models/Flashcard";
import { QuizSession } from "../models/QuizSession";
import { migrateTopics } from "./migrate-topics";

test("Topic validation and backward-compatible flashcard/session schemas", async () => {
  const scope = { userId: new Types.ObjectId(), subjectId: new Types.ObjectId() };
  assert.equal(normalizeTopicName("  Data\t STRUCTURES  "), "data structures");
  const topic = new Topic({ ...scope, name: " Arrays " });
  await topic.validate();
  assert.equal(topic.name, "Arrays");
  assert.equal(topic.normalizedName, "arrays");
  for (const invalid of [{ name: " " }, { name: "x".repeat(101) }, { description: "x".repeat(501) }, { position: -1 }, { position: 1.5 }, { subjectId: undefined }, { userId: undefined }]) {
    await assert.rejects(new Topic({ ...scope, name: "Valid", ...invalid }).validate());
  }
  for (const flashcardType of ["standard", "items"]) {
    for (const topicId of [undefined, new Types.ObjectId()]) {
      const card = new Flashcard({ ...scope, topicId, flashcardType, question: "Question", answer: "one\ntwo" });
      await card.validate();
      assert.equal(card.flashcardType, flashcardType);
    }
  }
  for (const status of ["active", "completed"]) await new QuizSession({ ...scope, status, subjectName: "Old", type: "identification", expiresAt: new Date(Date.now() + 86400000), questions: [{ flashcardId: new Types.ObjectId(), prompt: "Old snapshot", expectedAnswer: "Answer" }] }).validate();
});

test("isolated MongoDB: uniqueness, migration, progress preservation and recovery", async () => {
  // Starts its own ephemeral server. Never reads an application database URI.
  const server = await MongoMemoryServer.create();
  try {
    await mongoose.connect(server.getUri(), { dbName: "abii_topic_test", autoIndex: false, autoCreate: false });
    const db = mongoose.connection.db!;
    const userId = new Types.ObjectId();
    const subjectId = new Types.ObjectId();
    const otherSubject = new Types.ObjectId();
    await db.collection("users").insertOne({ _id: userId, name: "Test" });
    await db.collection("subjects").insertMany([{ _id: subjectId, userId }, { _id: otherSubject, userId }]);
    await Topic.createIndexes();
    const arrays = await Topic.create({ userId, subjectId, name: " Arrays " });
    await assert.rejects(Topic.create({ userId, subjectId, name: "arrays" }), isDuplicateTopicError);
    await Topic.create({ userId, subjectId: otherSubject, name: "ARRAYS" });
    const spaced = await Topic.create({ userId, subjectId, name: "Data  Structures" });
    await assert.rejects(Topic.create({ userId, subjectId, name: " data\tstructures " }), isDuplicateTopicError);
    await Topic.updateOne({ _id: spaced._id }, { $set: { name: " Linked Lists " } });
    assert.equal((await Topic.findById(spaced._id))!.normalizedName, "linked lists");
    const general = await Topic.create({ userId, subjectId, name: " GENERAL " });
    const timestamp = new Date("2020-01-01");
    const cards = [
      { _id: new Types.ObjectId(), userId, subjectId, flashcardType: "standard", question: "Q", answer: "A", hint: "H", createdAt: timestamp, updatedAt: timestamp },
      { _id: new Types.ObjectId(), userId, subjectId, topicId: null, flashcardType: "items", question: "List", answer: "one\ntwo", createdAt: timestamp, updatedAt: timestamp },
      { _id: new Types.ObjectId(), userId, subjectId, topicId: arrays._id, question: "Assigned", answer: "Keep" },
      { _id: new Types.ObjectId(), userId, subjectId: otherSubject, question: "Legacy default", answer: "Keep" },
    ];
    await db.collection("flashcards").insertMany(cards);
    await db.collection("reviewrecords").insertOne({ userId, flashcardId: cards[0]._id, result: "correct", questionType: "identification", reviewedAt: timestamp, nextReviewAt: timestamp });
    await db.collection("quizsessions").insertMany(["active", "completed"].map((status) => ({ userId, subjectId, status, questions: [{ flashcardId: cards[0]._id, prompt: "Snapshot", expectedAnswer: "A", round: 2, answered: true, correct: true }], expiresAt: new Date(Date.now() + 86400000) })));
    const reviews = await db.collection("reviewrecords").find().toArray();
    const sessions = await db.collection("quizsessions").find().toArray();
    const dry = await migrateTopics();
    assert.deepEqual(dry.errors, []);
    assert.equal(dry.plannedCards, 3);
    assert.equal(dry.plannedTopics, 1);
    assert.deepEqual(dry.before, dry.after);
    assert.deepEqual(await db.collection("flashcards").find().toArray(), cards);
    const first = await migrateTopics({ dryRun: false });
    assert.deepEqual(first.errors, []);
    assert.equal(first.assignedCards, 3);
    assert.equal(first.createdTopics, 1);
    assert.equal(first.idempotent, true);
    for (const name of ["users", "subjects", "flashcards", "reviewrecords", "quizsessions"]) assert.equal(first.before[name], first.after[name]);
    const migrated = await db.collection("flashcards").find().toArray();
    for (let i = 0; i < cards.length; i++) {
      const { topicId, ...rest } = migrated[i];
      const original = { ...cards[i] } as Record<string, unknown>;
      delete original.topicId;
      assert.deepEqual(rest, original);
      const parent = await Topic.findById(topicId);
      assert.equal(String(parent!.subjectId), String(cards[i].subjectId));
      assert.equal(String(parent!.userId), String(userId));
    }
    assert.equal(String(migrated[0].topicId), String(general._id));
    assert.equal(String(migrated[2].topicId), String(arrays._id));
    assert.deepEqual(await db.collection("reviewrecords").find().toArray(), reviews);
    assert.deepEqual(await db.collection("quizsessions").find().toArray(), sessions);
    const second = await migrateTopics({ dryRun: false });
    assert.equal(second.assignedCards, 0);
    assert.equal(second.createdTopics, 0);
    assert.equal(second.idempotent, true);
    assert.deepEqual(second.before, second.after);
    const foreignOwner = new Types.ObjectId();
    await db.collection("users").insertOne({ _id: foreignOwner, name: "Other owner" });
    const otherTopic = await Topic.findOne({ subjectId: otherSubject });
    for (const broken of [{ subjectId: new Types.ObjectId() }, { userId: new Types.ObjectId() }, { userId: foreignOwner }, { topicId: new Types.ObjectId() }, { topicId: otherTopic!._id }]) {
      const badId = new Types.ObjectId();
      await db.collection("flashcards").insertOne({ _id: badId, userId, subjectId, ...broken });
      const invalid = await migrateTopics({ dryRun: false });
      assert.ok(invalid.errors.length);
      assert.equal(invalid.assignedCards, 0);
      await db.collection("flashcards").deleteOne({ _id: badId });
    }
    const orphan = await Topic.create({ userId, subjectId: new Types.ObjectId(), name: "Orphan" });
    const invalidTopic = await migrateTopics({ dryRun: false });
    assert.match(invalidTopic.errors.join(), /Topic .*missing parent/);
    assert.equal(invalidTopic.assignedCards, 0);
    await Topic.deleteOne({ _id: orphan._id });
    // Simulate interruption after topic creation but before card assignment.
    await db.collection("flashcards").insertOne({ userId, subjectId, question: "Late", answer: "A" });
    const originalUpdate = Flashcard.updateMany;
    Flashcard.updateMany = (() => { throw new Error("Injected write failure"); }) as typeof Flashcard.updateMany;
    try { assert.match((await migrateTopics({ dryRun: false })).errors.join(), /Injected write failure/); }
    finally { Flashcard.updateMany = originalUpdate; }
    const resumed = await migrateTopics({ dryRun: false });
    assert.equal(resumed.assignedCards, 1);
    assert.equal(resumed.createdTopics, 0);
    assert.equal(resumed.idempotent, true);
  } finally {
    await mongoose.disconnect();
    await server.stop();
  }
});
