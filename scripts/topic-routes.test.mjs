import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SignJWT } from "jose";

test("real authenticated Next.js routes and legacy Subject/Flashcard contracts", { timeout: 240000 }, async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let child;
  let output = "";
  try {
    const uri = mongo.getUri("abii_http_test");
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const userId = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({ _id: userId, name: "Integration", email: "test@example.invalid", passwordHash: "never-export-this" });
    const secret = "isolated-topic-route-test-secret-at-least-32-characters";
    const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(String(userId)).setIssuer("abii").setAudience("abii-web").setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret));
    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    child = spawn(process.execPath, [fileURLToPath(new URL("./topic-test-server.mjs", import.meta.url)), String(port)], {
      cwd: process.cwd(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "development", MONGODB_URI: uri, AUTH_SECRET: secret, NEXT_TELEMETRY_DISABLED: "1" },
    });
    child.stdout.on("data", (data) => { output = (output + data).slice(-12000); });
    child.stderr.on("data", (data) => { output = (output + data).slice(-12000); });
    child.on("error", (error) => { output += error.message; });
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      if (output.includes("Ready in")) { ready = true; break; }
      if (child.exitCode !== null) throw new Error(`Next exited: ${output}`);
      await delay(200);
    }
    assert.ok(ready, `Next startup timed out: ${output}`);
    const request = async (path, method = "GET", body, etag, cookie = token) => {
      const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `abii_session=${cookie}` } : {}), ...(etag ? { "If-Match": etag } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
      const text = await response.text();
      assert.ok(response.headers.get("content-type")?.includes("application/json"), `Non-JSON response: ${text.slice(0, 500)}\n${output}`);
      return { status: response.status, body: JSON.parse(text), etag: response.headers.get("etag") };
    };
    const subject = await request("/api/subjects", "POST", { name: "HTTP compatibility" });
    assert.equal(subject.status, 201);
    const path = `/api/subjects/${subject.body.subject.id}`;
    const topics = `${path}/topics`;
    assert.equal((await request(`${path}/flashcards`, "POST", { question: "No topic", answer: "Rejected" })).status, 400);
    assert.equal((await request(topics, "GET", undefined, undefined, "")).status, 401);
    assert.equal((await request(topics, "GET", undefined, undefined, "invalid-token")).status, 401);
    const source = await request(topics, "POST", { name: "Source" });
    assert.equal(source.status, 201);
    const target = await request(topics, "POST", { name: "Target" });
    assert.equal(target.status, 201);
    const otherSubject = await request("/api/subjects", "POST", { name: "Other subject" });
    const otherTopic = await request(`/api/subjects/${otherSubject.body.subject.id}/topics`, "POST", { name: "Other topic" });
    assert.equal((await request(`${path}/flashcards`, "POST", { topicId: otherTopic.body.topic.id, question: "Wrong subject", answer: "Rejected" })).status, 404);
    const foreignUserId = new mongoose.Types.ObjectId();
    const foreignSubjectId = new mongoose.Types.ObjectId();
    const foreignTopicId = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({ _id: foreignUserId, name: "Foreign", email: "foreign@example.invalid" });
    await db.collection("subjects").insertOne({ _id: foreignSubjectId, userId: foreignUserId, name: "Foreign subject", createdAt: new Date(), updatedAt: new Date() });
    await db.collection("topics").insertOne({ _id: foreignTopicId, userId: foreignUserId, subjectId: foreignSubjectId, name: "Foreign topic", normalizedName: "foreign topic", position: 0, createdAt: new Date(), updatedAt: new Date() });
    assert.equal((await request(`${path}/flashcards`, "POST", { topicId: String(foreignTopicId), question: "Wrong user", answer: "Rejected" })).status, 404);
    const detailTopic = await request(topics, "POST", { name: "Detail topic" });
    assert.equal(detailTopic.status, 201);
    const topicCard = await request(`${path}/flashcards`, "POST", { topicId: detailTopic.body.topic.id, flashcardType: "standard", question: "In topic", answer: "Card" });
    assert.equal(topicCard.status, 201);
    assert.equal((await request(`${path}/flashcards`, "POST", { topicId: "not-an-object-id", question: "Invalid ID", answer: "Rejected" })).status, 400);
    assert.equal((await request(`${topics}/${detailTopic.body.topic.id}`)).body.topic.flashcardCount, 1);
    assert.equal((await request(`${path}/flashcards`, "POST", { topicId: String(new mongoose.Types.ObjectId()), question: "Invalid link", answer: "Must not save" })).status, 404);
    const itemPath = `${topics}/${source.body.topic.id}`;
    const read = await request(itemPath);
    assert.equal(read.status, 200);
    const renamed = await request(itemPath, "PATCH", { name: "Renamed" }, read.etag);
    assert.equal(renamed.status, 200);
    for (const flashcardType of ["standard", "items"]) {
      const card = await request(`${path}/flashcards`, "POST", { topicId: source.body.topic.id, flashcardType, question: "Question", answer: flashcardType === "items" ? "one\ntwo" : "Answer", hint: "Hint" });
      assert.equal(card.status, 201);
      assert.equal(card.body.card.flashcardType, flashcardType);
      assert.equal(card.body.card.topicId, source.body.topic.id);
      const cardPath = `${path}/flashcards/${card.body.card.id}`;
      assert.equal((await request(cardPath)).status, 200);
      const edited = await request(cardPath, "PATCH", { ...card.body.card, hint: "Updated hint" });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.masteryReset, false);
      assert.equal((await request(cardPath, "PATCH", { ...edited.body.card, topicId: otherTopic.body.topic.id })).status, 404);
      const cardId = new mongoose.Types.ObjectId(card.body.card.id);
      await db.collection("reviewrecords").insertOne({ userId, flashcardId: cardId, result: "correct", questionType: "random", reviewedAt: new Date(), nextReviewAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() });
      const snapshot = { flashcardId: cardId, prompt: "Stored question snapshot", expectedAnswer: "Stored answer snapshot" };
      await db.collection("quizsessions").insertMany(["active", "completed"].map((status) => ({ userId, subjectId: new mongoose.Types.ObjectId(subject.body.subject.id), subjectName: "HTTP compatibility", type: "identification", status, questions: [{ ...snapshot, answered: status === "completed", ...(status === "completed" ? { correct: true } : {}) }], ...(status === "completed" ? { completedAt: new Date() } : {}), expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() })));
      const moved = await request(cardPath, "PATCH", { ...edited.body.card, topicId: target.body.topic.id });
      assert.equal(moved.status, 200);
      assert.equal(moved.body.card.topicId, target.body.topic.id);
      assert.equal(moved.body.masteryReset, false);
      assert.equal(await db.collection("reviewrecords").countDocuments({ flashcardId: cardId }), 1);
      assert.equal(await db.collection("quizsessions").countDocuments({ "questions.flashcardId": cardId, status: { $in: ["active", "completed"] } }), 2);
      const changed = await request(cardPath, "PATCH", { ...moved.body.card, topicId: target.body.topic.id, answer: flashcardType === "items" ? "three\nfour" : "Changed answer" });
      assert.equal(changed.status, 200);
      assert.equal(changed.body.masteryReset, true);
      assert.equal(await db.collection("reviewrecords").countDocuments({ flashcardId: cardId }), 0);
      assert.equal(await db.collection("quizsessions").countDocuments({ "questions.flashcardId": cardId, status: "active" }), 0);
      assert.equal(await db.collection("quizsessions").countDocuments({ "questions.flashcardId": cardId, status: "completed" }), 1);
    }
    assert.equal((await request(`${path}/flashcards`)).body.cards.length, 3);
    assert.equal((await request(topics)).body.topics.find((row) => row.id === source.body.topic.id).flashcardCount, 0);
    assert.equal((await request(topics)).body.topics.find((row) => row.id === target.body.topic.id).flashcardCount, 2);
    assert.equal((await request(topics)).body.topics.find((row) => row.id === detailTopic.body.topic.id).flashcardCount, 1);
    const currentCards = (await request(`${path}/flashcards`)).body.cards;
    const scopes = [
      { scope: "all", topicId: undefined, ids: new Set(currentCards.map((card) => card.id)) },
      { scope: "subject", topicId: undefined, ids: new Set(currentCards.map((card) => card.id)) },
      { scope: "topic", topicId: target.body.topic.id, ids: new Set(currentCards.filter((card) => card.topicId === target.body.topic.id).map((card) => card.id)) },
      { scope: "topic", topicId: detailTopic.body.topic.id, ids: new Set(currentCards.filter((card) => card.topicId === detailTopic.body.topic.id).map((card) => card.id)) },
    ];
    let topicRetrySessionId;
    for (const selectedScope of scopes) for (const type of ["multiple-choice", "identification", "true-false", "random"]) {
      const { scope } = selectedScope;
      const payload = { scope, type, ...(scope !== "all" ? { subjectId: subject.body.subject.id } : {}), ...(selectedScope.topicId ? { topicId: selectedScope.topicId } : {}) };
      const started = await request("/api/quiz/start", "POST", payload);
      assert.equal(started.status, 201, `${scope}/${type}: ${started.body.error ?? "failed"}`);
      const session = await db.collection("quizsessions").findOne({ _id: new mongoose.Types.ObjectId(started.body.sessionId) });
      assert.equal(session.scope, scope);
      if (selectedScope.topicId) {
        assert.equal(String(session.topicId), selectedScope.topicId);
        assert.equal(session.topicName, selectedScope.topicId === detailTopic.body.topic.id ? "Detail topic" : "Target");
      }
      assert.ok(session.questions.length > 0);
      assert.ok(session.questions.every((question) => selectedScope.ids.has(String(question.flashcardId))), `${scope}/${type} included an out-of-scope question`);
      const restored = await request(`/api/quiz/${started.body.sessionId}/finish`);
      assert.equal(restored.status, 200);
      assert.equal(restored.body.session.scope, scope);
      if (selectedScope.topicId === target.body.topic.id && type === "identification") topicRetrySessionId = started.body.sessionId;
    }
    assert.ok(topicRetrySessionId);
    await db.collection("quizsessions").updateOne({ _id: new mongoose.Types.ObjectId(topicRetrySessionId) }, { $set: { "questions.$[].answered": true, "questions.$[].correct": false, "questions.$[].userAnswer": "incorrect", "questions.$[].answeredAt": new Date() } });
    const retried = await request(`/api/quiz/${topicRetrySessionId}/finish`, "POST");
    assert.equal(retried.status, 200);
    assert.equal(retried.body.retry, true);
    assert.equal(retried.body.session.scope, "topic");
    assert.equal(retried.body.session.topicId, target.body.topic.id);
    const retriedDoc = await db.collection("quizsessions").findOne({ _id: new mongoose.Types.ObjectId(topicRetrySessionId) });
    assert.ok(retriedDoc.questions.every((question) => scopes[2].ids.has(String(question.flashcardId))));
    for (const legacy of [{ subjectId: "all", type: "random" }, { subjectId: subject.body.subject.id, type: "identification" }]) {
      const started = await request("/api/quiz/start", "POST", legacy);
      assert.equal(started.status, 201);
      const session = await db.collection("quizsessions").findOne({ _id: new mongoose.Types.ObjectId(started.body.sessionId) });
      assert.equal(session.scope, legacy.subjectId === "all" ? "all" : "subject");
    }
    assert.equal((await request("/api/quiz/start", "POST", { scope: "all", topicId: detailTopic.body.topic.id, type: "random" })).status, 400);
    assert.equal((await request("/api/quiz/start", "POST", { scope: "wrong", subjectId: "all", type: "random" })).status, 400);
    assert.equal((await request("/api/quiz/start", "POST", { scope: "topic", subjectId: subject.body.subject.id, topicId: otherTopic.body.topic.id, type: "random" })).status, 404);
    assert.equal((await request("/api/quiz/start", "POST", { scope: "topic", subjectId: subject.body.subject.id, topicId: String(foreignTopicId), type: "random" })).status, 404);
    assert.equal((await request("/api/quiz/start", "POST", { scope: "subject", subjectId: otherSubject.body.subject.id, type: "random" })).status, 422);
    assert.equal((await request("/api/quiz/start", "POST", { scope: "topic", subjectId: subject.body.subject.id, topicId: source.body.topic.id, type: "random" })).status, 422);
    const exported = await request("/api/data/export");
    assert.equal(exported.status, 200);
    assert.ok(Array.isArray(exported.body.topics));
    assert.ok(exported.body.topics.some((topic) => String(topic._id) === source.body.topic.id && topic.name === "Renamed"));
    assert.ok(exported.body.flashcards.some((card) => card.topicId === target.body.topic.id));
    assert.equal(JSON.stringify(exported.body).includes("never-export-this"), false);
    assert.ok(exported.body.completedStudySessions.some((session) => session.questions.some((question) => question.prompt === "Stored question snapshot")));
    assert.ok(exported.body.completedStudySessions.some((session) => session.scope === undefined), "legacy completed sessions should export without requiring scope metadata");
    const legacyHistory = await db.collection("quizsessions").findOne({ userId, status: "completed", "questions.prompt": "Stored question snapshot" });
    const legacyLoaded = await request(`/api/quiz/${String(legacyHistory._id)}/finish`);
    assert.equal(legacyLoaded.status, 200);
    assert.equal(legacyLoaded.body.session.scope, "subject");
    assert.equal(legacyLoaded.body.session.topicId, null);
    await db.collection("quizsessions").updateOne({ _id: new mongoose.Types.ObjectId(topicRetrySessionId) }, { $set: { status: "completed", completedAt: new Date(), "questions.$[].answered": true, "questions.$[].correct": true } });
    const targetDetail = await request(`${topics}/${target.body.topic.id}`);
    assert.equal((await request(`${topics}/${target.body.topic.id}`, "PATCH", { name: "Renamed Target" }, targetDetail.etag)).status, 200);
    const renamedHistory = await request(`/api/quiz/${topicRetrySessionId}/finish`);
    assert.equal(renamedHistory.status, 200);
    assert.equal(renamedHistory.body.session.topicId, target.body.topic.id);
    assert.equal(renamedHistory.body.session.topicName, "Target", "historical topic metadata stays as the session snapshot after a topic rename");
    const populatedPath = `${topics}/${detailTopic.body.topic.id}`;
    const populated = await request(populatedPath);
    assert.equal((await request(populatedPath, "DELETE", { confirm: true }, populated.etag)).status, 409);
    const transferred = await request(populatedPath, "DELETE", { confirm: true, destinationTopicId: target.body.topic.id }, populated.etag);
    assert.equal(transferred.status, 200);
    assert.equal(transferred.body.movedFlashcardCount, 1);
    assert.equal((await request(itemPath, "DELETE", { confirm: true }, renamed.etag)).status, 200);
    const cards = (await request(`${path}/flashcards`)).body.cards;
    assert.equal((await request(`${path}/flashcards/${cards[0].id}`, "DELETE")).status, 200);
    assert.equal((await request(path, "PATCH", { name: "Subject renamed" })).status, 200);
    assert.equal((await request(path, "DELETE")).status, 200);
    assert.equal(await db.collection("topics").countDocuments({ subjectId: new mongoose.Types.ObjectId(subject.body.subject.id) }), 0);
    assert.equal(await db.collection("flashcards").countDocuments(), 0);
    assert.equal(await db.collection("reviewrecords").countDocuments({ userId }), 0);
    assert.equal(await db.collection("quizsessions").countDocuments({ userId, status: "active" }), 0);

    const materialSubject = await request("/api/subjects", "POST", { name: "Materials cleanup" });
    const materialTopic = await request(`/api/subjects/${materialSubject.body.subject.id}/topics`, "POST", { name: "Cleanup topic" });
    assert.equal((await request(`/api/subjects/${materialSubject.body.subject.id}/flashcards`, "POST", { topicId: materialTopic.body.topic.id, question: "Cleanup card", answer: "Cleanup answer" })).status, 201);
    const materialClear = await request("/api/data/materials", "DELETE", {});
    assert.equal(materialClear.status, 200);
    for (const collection of ["subjects", "topics", "flashcards", "reviewrecords", "quizsessions"]) assert.equal(await db.collection(collection).countDocuments({ userId }), 0, `${collection} should be cleared for this user`);
    assert.equal(await db.collection("topics").countDocuments({ userId: foreignUserId }), 1, "clearing materials must preserve another user's topics");

    const accountSubject = await request("/api/subjects", "POST", { name: "Account cleanup" });
    const accountTopic = await request(`/api/subjects/${accountSubject.body.subject.id}/topics`, "POST", { name: "Account topic" });
    assert.equal(accountTopic.status, 201);
    const accountDelete = await request("/api/account", "DELETE", { confirmation: "DELETE" });
    assert.equal(accountDelete.status, 200);
    assert.equal(await db.collection("users").countDocuments({ _id: userId }), 0);
    for (const collection of ["subjects", "topics", "flashcards", "reviewrecords", "quizsessions"]) assert.equal(await db.collection(collection).countDocuments({ userId }), 0, `${collection} should be deleted with the account`);
    assert.equal(await db.collection("topics").countDocuments({ userId: foreignUserId }), 1, "account deletion must preserve another user's topics");
  } catch (error) {
    throw new Error(`${error.message}\nNext server output:\n${output}`, { cause: error });
  } finally {
    if (child?.pid && child.exitCode === null) {
      const stopped = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await stopped;
    }
    await mongoose.disconnect();
    await mongo.stop();
  }
});
