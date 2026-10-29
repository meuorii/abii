import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SubjectFolder, normalizeSubjectFolderName } from "../models/SubjectFolder";
import { Subject } from "../models/Subject";
import { Topic } from "../models/Topic";
import { Flashcard } from "../models/Flashcard";
import { createSubjectFolder, changeSubjectFolder, listSubjectFolders } from "../lib/subject-folders/service";

test("subject folder name normalization and schema validation", async () => {
  const userId = new Types.ObjectId();
  const folder = new SubjectFolder({ userId, name: "  Ｆｉｎａｌｓ  ", normalizedName: normalizeSubjectFolderName(" Finals "), position: 0 });
  await folder.validate();
  assert.equal(folder.name, "Finals");
  assert.equal(folder.normalizedName, "finals");
  await assert.rejects(new SubjectFolder({ userId, name: " ", normalizedName: "", position: 0 }).validate());
  await assert.rejects(new SubjectFolder({ userId, name: "Other", normalizedName: "other", position: -1 }).validate());
  assert.ok(SubjectFolder.schema.indexes().some(([keys, options]) => keys.userId === 1 && keys.normalizedName === 1 && options.unique));
});

test("subject folders count multiple subjects and transactionally unfile without changing study data", { timeout: 180000 }, async () => {
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  try {
    await mongoose.connect(server.getUri(), { dbName: "subject_folders_test" });
    const owner = new Types.ObjectId(), other = new Types.ObjectId();
    await SubjectFolder.createIndexes(); await Topic.createIndexes(); await Flashcard.createIndexes();
    const folder = await createSubjectFolder(String(owner), { name: "2nd Year — Semester 1", description: "Current work" });
    await assert.rejects(createSubjectFolder(String(owner), { name: " 2ND YEAR — SEMESTER 1 " }), (error: unknown) => (error as { status: number }).status === 409);
    const first = await Subject.create({ userId: owner, name: "Algorithms", subjectFolderId: folder.id });
    const second = await Subject.create({ userId: owner, name: "Databases", subjectFolderId: folder.id });
    const unfiled = await Subject.create({ userId: owner, name: "Unfiled" });
    const topic1 = await Topic.create({ userId: owner, subjectId: first._id, name: "Graphs" });
    const topic2 = await Topic.create({ userId: owner, subjectId: second._id, name: "SQL" });
    const card1 = await Flashcard.create({ userId: owner, subjectId: first._id, topicId: topic1._id, question: "Q1", answer: "A1", flashcardType: "standard" });
    const card2 = await Flashcard.create({ userId: owner, subjectId: second._id, topicId: topic2._id, question: "Q2", answer: "A2", flashcardType: "standard" });
    const summary = (await listSubjectFolders(String(owner)))[0];
    assert.deepEqual([summary.subjectCount, summary.topicCount, summary.flashcardCount], [2, 2, 2]);
    assert.deepEqual([(await listSubjectFolders(String(other))).length], [0]);
    await assert.rejects(changeSubjectFolder(String(owner), folder.id, { name: "Renamed" }, "2000-01-01T00:00:00.000Z"), (error: unknown) => (error as { status: number }).status === 409);
    const result = await changeSubjectFolder(String(owner), folder.id, { confirm: true }, folder.updatedAt, true);
    assert.ok("success" in result && result.movedSubjectCount === 2);
    assert.equal((await Subject.findById(first._id))?.subjectFolderId, null);
    assert.equal((await Subject.findById(second._id))?.subjectFolderId, null);
    assert.equal((await Subject.findById(unfiled._id))?.subjectFolderId, null);
    assert.ok(await Topic.exists({ _id: topic1._id })); assert.ok(await Topic.exists({ _id: topic2._id }));
    assert.ok(await Flashcard.exists({ _id: card1._id })); assert.ok(await Flashcard.exists({ _id: card2._id }));
    assert.equal(await SubjectFolder.countDocuments({ userId: owner }), 0);
  } finally { await mongoose.disconnect(); await server.stop(); }
});
