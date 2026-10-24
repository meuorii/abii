import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";
import { topicHandlers } from "../lib/topics/http";
import { Topic } from "../models/Topic";
import { Subject } from "../models/Subject";
import { Flashcard } from "../models/Flashcard";

test("Topic HTTP boundary with real replica-set persistence", { timeout: 180000 }, async (t) => {
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  try {
    await mongoose.connect(server.getUri(), { dbName: "topic_api_test", autoIndex: false });
    await Topic.createIndexes();
    await Subject.createCollection();
    await Flashcard.createCollection();
    const owner = new Types.ObjectId();
    const stranger = new Types.ObjectId();
    const subject = await Subject.create({ userId: owner, name: "Subject" });
    const other = await Subject.create({ userId: owner, name: "Other" });
    const foreign = await Subject.create({ userId: stranger, name: "Private" });
    let identity: Types.ObjectId | null = owner;
    const handlers = topicHandlers({ getCurrentUser: async () => identity ? { _id: identity } : null, connectToDatabase: async () => mongoose });
    const request = async (method: keyof typeof handlers, body?: unknown, id?: string, etag?: string, parent = String(subject._id)) => {
      const response = await handlers[method](new Request("http://localhost/api/topics", { method, headers: { "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { params: Promise.resolve({ subjectId: parent, topicId: id }) });
      return { status: response.status, body: await response.json(), etag: response.headers.get("ETag")! };
    };
    let source: Awaited<ReturnType<typeof request>>;
    let destination: Awaited<ReturnType<typeof request>>;
    await t.test("authentication, malformed JSON, unsupported fields and values", async () => {
      identity = null;
      for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) assert.equal((await request(method, method === "GET" ? undefined : {}, String(new Types.ObjectId()))).status, 401);
      identity = owner;
      for (const body of [null, [], {}, { name: " " }, { name: 7 }, { name: "x".repeat(101) }, { name: "A", description: false }, { name: "A", description: "x".repeat(501) }, { name: "A", userId: String(stranger) }, { name: "A", position: 0 }]) assert.equal((await request("POST", body)).status, 400);
      const bad = await handlers.POST(new Request("http://localhost", { method: "POST", body: "{" }), { params: Promise.resolve({ subjectId: String(subject._id) }) });
      assert.equal(bad.status, 400);
      assert.equal((await request("GET", undefined, undefined, undefined, "invalid")).status, 404);
    });
    await t.test("create, normalized duplicates, list, single and genuine counts", async () => {
      source = await request("POST", { name: "  Data\t Structures  ", description: "Basics" });
      assert.equal(source.status, 201);
      assert.equal(source.body.topic.name, "Data Structures");
      assert.equal(source.body.topic.position, 0);
      assert.equal((await request("POST", { name: "data structures" })).status, 409);
      assert.equal((await request("POST", { name: "data structures" }, undefined, undefined, String(other._id))).status, 201);
      destination = await request("POST", { name: "Destination" });
      assert.equal(destination.body.topic.position, 1);
      const single = await request("GET", undefined, source.body.topic.id);
      assert.equal(single.etag, source.etag);
      assert.equal(single.body.topic.metrics.flashcardCount, 0);
      assert.equal("userId" in single.body.topic, false);
      assert.equal("normalizedName" in single.body.topic, false);
      assert.equal("mastery" in single.body.topic.metrics, false);
      assert.deepEqual((await request("GET")).body.topics.map((topic: { id: string }) => topic.id), [source.body.topic.id, destination.body.topic.id]);
    });
    await t.test("ownership, cross-subject access and missing resources", async () => {
      for (const parent of [String(other._id), String(foreign._id), String(new Types.ObjectId())]) {
        assert.equal((await request("GET", undefined, source.body.topic.id, undefined, parent)).status, 404);
        assert.equal((await request("PATCH", { name: "Stolen" }, source.body.topic.id, source.etag, parent)).status, 404);
        assert.equal((await request("DELETE", { confirm: true }, source.body.topic.id, source.etag, parent)).status, 404);
      }
      assert.equal((await request("POST", { name: "Private" }, undefined, undefined, String(foreign._id))).status, 404);
      assert.equal((await request("GET", undefined, String(new Types.ObjectId()))).status, 404);
      identity = stranger;
      assert.equal((await request("GET")).status, 404);
      assert.equal((await request("GET", undefined, source.body.topic.id)).status, 404);
      identity = owner;
    });
    const db = mongoose.connection.db!;
    const timestamp = new Date("2020-01-01");
    const card = await Flashcard.create({ userId: owner, subjectId: subject._id, topicId: source!.body.topic.id, question: "Snapshot", answer: "A", flashcardType: "items", createdAt: timestamp, updatedAt: timestamp });
    await db.collection("reviewrecords").insertOne({ userId: owner, flashcardId: card._id, result: "correct", reviewedAt: timestamp, nextReviewAt: timestamp });
    await db.collection("quizsessions").insertMany(["active", "completed"].map((status) => ({ userId: owner, status, questions: [{ flashcardId: card._id, prompt: "Stored snapshot", round: 2, correct: true }] })));
    const beforeCard = await Flashcard.findById(card._id).lean();
    const beforeReviews = await db.collection("reviewrecords").find().toArray();
    const beforeSessions = await db.collection("quizsessions").find().toArray();
    await t.test("rename, description, strict PATCH and stale/concurrent edits", async () => {
      assert.equal((await request("PATCH", { name: "New" }, source.body.topic.id)).status, 428);
      assert.equal((await request("PATCH", { name: "New" }, source.body.topic.id, "bad")).status, 400);
      for (const body of [{}, { position: -1 }, { position: 1.5 }, { position: 99 }, { subjectId: String(other._id) }, { description: null }, { name: "" }]) assert.equal((await request("PATCH", body, source.body.topic.id, source.etag)).status, 400);
      assert.equal((await request("PATCH", { name: "destination" }, source.body.topic.id, source.etag)).status, 409);
      const old = source.etag;
      source = await request("PATCH", { name: "Renamed", description: "Updated" }, source.body.topic.id, source.etag);
      assert.equal(source.status, 200);
      assert.equal(source.body.topic.description, "Updated");
      assert.equal(source.body.topic.flashcardCount, 1);
      assert.equal((await request("PATCH", { name: "Stale" }, source.body.topic.id, old)).status, 409);
      const attempts = await Promise.all(["First", "Second"].map((description) => request("PATCH", { description }, source.body.topic.id, source.etag)));
      assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 409]);
      source = await request("GET", undefined, source.body.topic.id);
      assert.deepEqual(await Flashcard.findById(card._id).lean(), beforeCard);
    });
    await t.test("serialized creation and reordering", async () => {
      const created = await Promise.all(["Concurrent A", "Concurrent B"].map((name) => request("POST", { name })));
      assert.ok(created.every((r) => r.status === 201));
      assert.notEqual(created[0].body.topic.position, created[1].body.topic.position);
      const duplicates = await Promise.all([1, 2].map(() => request("POST", { name: "Concurrent duplicate" })));
      assert.deepEqual(duplicates.map((r) => r.status).sort(), [201, 409]);
      destination = await request("PATCH", { position: 0 }, destination.body.topic.id, destination.etag);
      assert.equal(destination.status, 200);
      const topics = (await request("GET")).body.topics;
      assert.deepEqual(topics.map((topic: { position: number }) => topic.position), topics.map((_: unknown, i: number) => i));
      source = await request("GET", undefined, source.body.topic.id);
    });
    await t.test("explicit deletion policy and invalid transfer destinations", async () => {
      assert.equal((await request("DELETE", {}, source.body.topic.id, source.etag)).status, 400);
      assert.equal((await request("DELETE", { confirm: true, destructive: true }, source.body.topic.id, source.etag)).status, 400);
      assert.equal((await request("DELETE", { confirm: true }, source.body.topic.id, source.etag)).status, 409);
      assert.equal((await request("DELETE", { confirm: true, destinationTopicId: source.body.topic.id }, source.body.topic.id, source.etag)).status, 400);
      const foreignTopic = await Topic.create({ userId: stranger, subjectId: foreign._id, name: "Foreign" });
      const differentSubject = await Topic.findOne({ subjectId: other._id });
      for (const id of [String(new Types.ObjectId()), String(foreignTopic._id), String(differentSubject!._id)]) assert.equal((await request("DELETE", { confirm: true, destinationTopicId: id }, source.body.topic.id, source.etag)).status, 404);
    });
    await t.test("transaction rollback on failure after transfer", async () => {
      const original = Topic.deleteOne;
      const log = t.mock.method(console, "error", () => {});
      Topic.deleteOne = (() => { throw new Error("Injected deletion failure"); }) as typeof Topic.deleteOne;
      try { assert.equal((await request("DELETE", { confirm: true, destinationTopicId: destination.body.topic.id }, source.body.topic.id, source.etag)).status, 500); }
      finally { Topic.deleteOne = original; log.mock.restore(); }
      assert.deepEqual(await Flashcard.findById(card._id).lean(), beforeCard);
      assert.ok(await Topic.exists({ _id: source.body.topic.id }));
    });
    await t.test("transfer then delete preserves all study state and timestamps", async () => {
      const removed = await request("DELETE", { confirm: true, destinationTopicId: destination.body.topic.id }, source.body.topic.id, source.etag);
      assert.equal(removed.status, 200);
      assert.equal(removed.body.movedFlashcardCount, 1);
      assert.equal(await Topic.exists({ _id: source.body.topic.id }), null);
      const afterCard = await Flashcard.findById(card._id).lean();
      assert.equal(String(afterCard!.topicId), destination.body.topic.id);
      assert.deepEqual({ ...afterCard, topicId: beforeCard!.topicId }, beforeCard);
      assert.deepEqual(await db.collection("reviewrecords").find().toArray(), beforeReviews);
      assert.deepEqual(await db.collection("quizsessions").find().toArray(), beforeSessions);
      const listed = (await request("GET")).body.topics;
      assert.equal(listed.find((row: { id: string }) => row.id === destination.body.topic.id).flashcardCount, 1);
      const empty = await request("POST", { name: "Empty" });
      assert.equal((await request("DELETE", { confirm: true }, empty.body.topic.id, empty.etag)).status, 200);
    });
    await t.test("opposing concurrent transfers never leave dangling cards", async () => {
      const left = await request("POST", { name: "Left" });
      const right = await request("POST", { name: "Right" });
      const pair = [left, right];
      const inserted = await Flashcard.create(pair.map((row) => ({ userId: owner, subjectId: subject._id, topicId: row.body.topic.id, question: "Concurrent", answer: "A" })));
      const attempts = await Promise.all(pair.map((row, i) => request("DELETE", { confirm: true, destinationTopicId: pair[1 - i].body.topic.id }, row.body.topic.id, row.etag)));
      assert.equal(attempts.filter((row) => row.status === 200).length, 1);
      assert.ok(attempts.every((row) => [200, 404, 409].includes(row.status)));
      for (const card of inserted) {
        const saved = await Flashcard.findById(card._id);
        assert.ok(saved);
        assert.ok(await Topic.exists({ _id: saved.topicId, userId: owner, subjectId: subject._id }));
      }
    });
    await t.test("database duplicate-key errors return a safe conflict", async () => {
      const original = Topic.create;
      Topic.create = (() => { throw new mongoose.mongo.MongoServerError({ code: 11000, message: "Injected unique-index conflict" }); }) as typeof Topic.create;
      try {
        const response = await request("POST", { name: "Index conflict" });
        assert.equal(response.status, 409);
        assert.equal(JSON.stringify(response.body).includes("Injected"), false);
      } finally { Topic.create = original; }
    });
  } finally { await mongoose.disconnect(); await server.stop(); }
});

test("standalone MongoDB refuses topic mutations without writing", { timeout: 60000 }, async () => {
  const server = await MongoMemoryServer.create();
  try {
    await mongoose.connect(server.getUri(), { dbName: "topic_standalone_test", autoIndex: false });
    const owner = new Types.ObjectId();
    const subject = await Subject.create({ userId: owner, name: "Standalone" });
    const handlers = topicHandlers({ getCurrentUser: async () => ({ _id: owner }), connectToDatabase: async () => mongoose });
    const response = await handlers.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ name: "Must not save" }) }), { params: Promise.resolve({ subjectId: String(subject._id) }) });
    assert.equal(response.status, 503);
    assert.equal(await Topic.countDocuments(), 0);
    assert.equal((await Subject.findById(subject._id).select("+topicRevision"))!.topicRevision, 0);
  } finally { await mongoose.disconnect(); await server.stop(); }
});
