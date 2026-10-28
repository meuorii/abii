import { test } from "node:test";
import assert from "node:assert/strict";
import { Folder, normalizeFolderName } from "../models/Folder";
import { Topic } from "../models/Topic";
import { topicPayload } from "../lib/topics/validation";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Subject } from "../models/Subject";
import { Flashcard } from "../models/Flashcard";
import { createFolder, changeFolder, listFolders } from "../lib/folders/service";
import { createTopic, updateTopic } from "../lib/topics/service";

test("folder names normalize and enforce schema constraints", async () => {
  const scope = { userId: new Types.ObjectId(), subjectId: new Types.ObjectId() };
  const folder = new Folder({ ...scope, name: "  ＰＲＥＬＩＭＳ  " });
  await folder.validate();
  assert.equal(folder.name, "PRELIMS"); assert.equal(folder.normalizedName, normalizeFolderName("prelims"));
  await assert.rejects(new Folder({ ...scope, name: "  " }).validate());
  await assert.rejects(new Folder({ ...scope, name: "a", position: -1 }).validate());
  assert.ok(Folder.schema.indexes().some(([keys, options]) => keys.normalizedName === 1 && options.unique));
});
test("topic folder selection remains optional and validates IDs", () => {
  const id = new Types.ObjectId().toString();
  assert.equal(topicPayload({ name: "Test" }, true).folderId, undefined);
  assert.equal(topicPayload({ folderId: null }, false).folderId, null);
  assert.equal(topicPayload({ folderId: id }, false).folderId, id);
  assert.throws(() => topicPayload({ folderId: "invalid" }, false));
  assert.equal(new Topic({ userId: new Types.ObjectId(), subjectId: new Types.ObjectId(), name: "Test" }).folderId, null);
});

test("folder transactions preserve study data and reject invalid assignments", { timeout: 180000 }, async () => {
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  try {
    await mongoose.connect(server.getUri(), { dbName: "folders_test", autoIndex: false });
    await Folder.createIndexes(); await Topic.createIndexes();
    const owner = new Types.ObjectId();
    const subject = await Subject.create({ userId: owner, name: "Subject" });
    const other = await Subject.create({ userId: owner, name: "Other" });
    const uid = String(owner), sid = String(subject._id);
    const folder = await createFolder(uid, sid, { name: " Prelims " });
    await assert.rejects(createFolder(uid, sid, { name: "prelims" }), (error: unknown) => (error as { status: number }).status === 409);
    const foreignFolder = await createFolder(uid, String(other._id), { name: "Prelims" });
    await assert.rejects(createTopic(uid, sid, { name: "Invalid", folderId: foreignFolder.id }), (error: unknown) => (error as { status: number }).status === 404);
    const topic = await createTopic(uid, sid, { name: "Arrays", folderId: folder.id });
    const card = await Flashcard.create({ userId: owner, subjectId: subject._id, topicId: topic.id, question: "Q", answer: "A", flashcardType: "items" });
    const beforeCard = await Flashcard.findById(card._id).lean();
    const db = mongoose.connection.db!;
    await db.collection("quizsessions").insertOne({ userId: owner, status: "active", questions: [{ flashcardId: card._id, prompt: "Snapshot" }] });
    const sessions = await db.collection("quizsessions").find().toArray();
    assert.equal((await listFolders(uid, sid))[0].flashcardCount, 1);
    await assert.rejects(changeFolder(uid, sid, folder.id, { confirm: true }, "2000-01-01T00:00:00.000Z", true), (error: unknown) => (error as { status: number }).status === 409);
    const invalid = await Topic.create({ userId: new Types.ObjectId(), subjectId: other._id, folderId: folder.id, name: "Invalid reference" });
    await assert.rejects(changeFolder(uid, sid, folder.id, { confirm: true }, folder.updatedAt, true), (error: unknown) => (error as { status: number }).status === 409);
    assert.equal(String((await Topic.findById(topic.id))!.folderId), folder.id);
    assert.ok(await Folder.exists({ _id: folder.id }));
    await Topic.deleteOne({ _id: invalid._id });
    const result = await changeFolder(uid, sid, folder.id, { confirm: true }, folder.updatedAt, true);
    assert.ok("success" in result && result.movedTopicCount === 1);
    const moved = await Topic.findById(topic.id);
    assert.equal(moved!.folderId, null);
    assert.notEqual(moved!.updatedAt.toISOString(), topic.updatedAt);
    assert.deepEqual(await Flashcard.findById(card._id).lean(), beforeCard);
    assert.deepEqual(await db.collection("quizsessions").find().toArray(), sessions);
    await assert.rejects(updateTopic(uid, sid, topic.id, { folderId: foreignFolder.id }, moved!.updatedAt.toISOString()), (error: unknown) => (error as { status: number }).status === 404);
  } finally { await mongoose.disconnect(); await server.stop(); }
});
