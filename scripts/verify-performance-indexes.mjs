import nextEnv from "@next/env";
import { MongoClient, ObjectId } from "mongodb";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
const stages = (node, result = []) => {
  if (!node || typeof node !== "object") return result;
  if (node.stage) result.push(node.stage);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const item of value) stages(item, result);
    else if (value && typeof value === "object") stages(value, result);
  }
  return result;
};

try {
  await client.connect();
  const db = client.db();
  const build = await db.admin().command({ buildInfo: 1 });
  process.stdout.write(`MongoDB server version: ${build.version}\n`);
  const owner = new ObjectId("000000000000000000000001");
  const cases = [
    ["reviewrecords", "review_owner_mode_card_recent", { userId: owner, questionType: "multiple-choice", flashcardId: owner }, { reviewedAt: -1, _id: -1 }, { userId: 1, questionType: 1, flashcardId: 1, reviewedAt: -1, _id: -1 }],
    ["reviewrecords", "review_owner_quiz_question_unique", { userId: owner, quizSessionId: owner, quizQuestionIndex: 0 }, {}, { userId: 1, quizSessionId: 1, quizQuestionIndex: 1 }, { unique: true, partialFilterExpression: { quizSessionId: { $type: "objectId" } } }],
    ["reviewrecords", "review_owner_pending_achievement", { userId: owner, quizSessionId: { $type: "objectId" }, achievementEventsRecorded: { $ne: true } }, {}, { userId: 1, achievementEventsRecorded: 1 }, { partialFilterExpression: { quizSessionId: { $type: "objectId" } } }],
    ["quizsessions", "quiz_active_owner_activity", { userId: owner, status: "active", expiresAt: { $gt: new Date() } }, { lastActivityAt: -1 }, null, {}],
    ["quizsessions", "quiz_active_owner_recent_sort", { userId: owner, status: "active", expiresAt: { $gt: new Date() } }, { lastActivityAt: -1 }, { userId: 1, status: 1, lastActivityAt: -1, expiresAt: 1 }, {}],
    ["achievementevents", "achievement_event_owner_key_unique", { userId: owner, idempotencyKey: "index-verification" }, {}, null, {}],
    ["badgereconciliations", "badge_reconciliation_owner_unique", { userId: owner }, {}, null, {}],
  ];
  const createMissing = process.argv.includes("--create-missing");
  for (const [collectionName, expected, filter, sort, key, indexOptions] of cases) {
    const collection = db.collection(collectionName);
    const indexes = await collection.indexes();
    let found = indexes.some((index) => index.name === expected);
    if (!found && createMissing && key) {
      await collection.createIndex(key, { name: expected, ...indexOptions });
      found = true;
      process.stdout.write(`${collectionName}: created ${expected}\n`);
    }
    const explain = await collection.find(filter).sort(sort).limit(3).explain("executionStats");
    const winningPlan = explain.queryPlanner?.winningPlan;
    process.stdout.write(`${collectionName}: ${found ? "index present" : `MISSING ${expected}`}; stages=${[...new Set(stages(winningPlan))].join(",")}; docsExamined=${explain.executionStats?.totalDocsExamined ?? "n/a"}; keysExamined=${explain.executionStats?.totalKeysExamined ?? "n/a"}\n`);
    if (!found) process.exitCode = 1;
  }
} finally {
  await client.close();
}
