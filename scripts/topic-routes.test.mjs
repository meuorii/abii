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
    await db.collection("users").insertOne({ _id: userId, name: "Integration", email: "test@example.invalid" });
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
      const snapshot = { flashcardId: cardId, prompt: "Stored question snapshot", expectedAnswer: "Stored answer snapshot", answered: false };
      await db.collection("quizsessions").insertMany(["active", "completed"].map((status) => ({ userId, subjectId: new mongoose.Types.ObjectId(subject.body.subject.id), subjectName: "HTTP compatibility", type: "identification", status, questions: [snapshot], expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() })));
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
