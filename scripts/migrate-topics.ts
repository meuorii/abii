import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import mongoose, { Types } from "mongoose";
import { Topic, normalizeTopicName, isDuplicateTopicError } from "../models/Topic";
import { Flashcard } from "../models/Flashcard";

const unassigned = { topicId: null }; // MongoDB matches missing and explicit null.
const same = (a: unknown, b: unknown) => a instanceof Types.ObjectId && b instanceof Types.ObjectId && a.equals(b);

/** No automatic connection: callers must explicitly select a safe database. */
export async function migrateTopics({ dryRun = true } = {}) {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Connect to an explicitly selected database first");
  const summary = { dryRun, before: {} as Record<string, number>, after: {} as Record<string, number>, plannedCards: 0, plannedTopics: 0, assignedCards: 0, createdTopics: 0, remaining: 0, idempotent: false, errors: [] as string[] };
  async function snapshot() {
    const counts: Record<string, number> = {};
    const hashes: Record<string, string> = {};
    for (const name of ["users", "subjects", "flashcards", "reviewrecords", "quizsessions", "topics"]) {
      const hash = createHash("sha256");
      counts[name] = 0;
      for await (const document of db!.collection(name).find().sort({ _id: 1 })) {
        counts[name]++;
        if (name === "flashcards") delete document.topicId;
        hash.update(JSON.stringify(document));
      }
      hashes[name] = hash.digest("hex");
    }
    return { counts, hashes };
  }
  async function validateRelationships() {
    for await (const topic of db!.collection("topics").find()) {
      if (!(topic.userId instanceof Types.ObjectId) || !(topic.subjectId instanceof Types.ObjectId) ||
        !await db!.collection("users").findOne({ _id: topic.userId }) ||
        !await db!.collection("subjects").findOne({ _id: topic.subjectId, userId: topic.userId })) {
        throw new Error(`Topic ${topic._id}: missing parent or ownership mismatch`);
      }
      await new Topic(topic).validate();
      if (topic.normalizedName !== normalizeTopicName(topic.name)) throw new Error(`Topic ${topic._id}: inconsistent normalizedName`);
    }
    for await (const card of db!.collection("flashcards").find()) {
      if (!(card.userId instanceof Types.ObjectId) || !(card.subjectId instanceof Types.ObjectId) ||
        !await db!.collection("users").findOne({ _id: card.userId }) ||
        !await db!.collection("subjects").findOne({ _id: card.subjectId, userId: card.userId })) {
        throw new Error(`Flashcard ${card._id}: missing parent or ownership mismatch`);
      }
      if (card.topicId != null) {
        const topic = card.topicId instanceof Types.ObjectId ? await db!.collection("topics").findOne({ _id: card.topicId }) : null;
        if (!topic || !same(topic.userId, card.userId) || !same(topic.subjectId, card.subjectId)) throw new Error(`Flashcard ${card._id}: invalid topic relationship`);
      }
    }
    const duplicates = await db!.collection("topics").aggregate([
      { $group: { _id: { userId: "$userId", subjectId: "$subjectId", normalizedName: "$normalizedName" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $limit: 1 },
    ]).toArray();
    if (duplicates.length) throw new Error("Duplicate normalized topic names exist; resolve them before migration");
  }
  const before = await snapshot();
  summary.before = before.counts;
  try {
    // Fail before any writes for malformed references, ownership, or topic data.
    await validateRelationships();
    const groups = await db.collection("flashcards").aggregate<{ _id: { userId: Types.ObjectId; subjectId: Types.ObjectId }; count: number }>([
      { $match: unassigned }, { $group: { _id: { userId: "$userId", subjectId: "$subjectId" }, count: { $sum: 1 } } },
    ]).toArray();
    if (!dryRun) {
      // Add indexes only; never sync/drop indexes or initialize unrelated models.
      await Topic.createIndexes();
      await db.collection("flashcards").createIndex({ userId: 1, subjectId: 1, topicId: 1 }, { name: "flashcard_owner_subject_topic" });
    }
    for (const group of groups) {
      const scope = group._id;
      summary.plannedCards += group.count;
      try {
        const key = { ...scope, normalizedName: normalizeTopicName("General") };
        let topic = await Topic.findOne(key).lean();
        if (!topic) {
          summary.plannedTopics++;
          if (!dryRun) {
            try {
              topic = (await Topic.create({ ...scope, name: "General", position: 0 })).toObject();
              summary.createdTopics++;
            } catch (error) {
              if (!isDuplicateTopicError(error)) throw error;
              topic = await Topic.findOne(key).lean();
              if (!topic) throw new Error("General topic creation conflicted; rerun after resolving the index conflict");
            }
          }
        }
        if (!dryRun && topic) {
          const result = await Flashcard.updateMany({ ...scope, ...unassigned }, { $set: { topicId: topic._id } }, { timestamps: false });
          summary.assignedCards += result.modifiedCount;
        }
      } catch (error) {
        summary.errors.push(`Subject ${scope.subjectId}: ${error instanceof Error ? error.message : "unknown failure"}. Earlier assignments are retained; fix the cause and rerun.`);
        break;
      }
    }
    await validateRelationships();
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : "Unknown migration failure");
  }
  const after = await snapshot();
  summary.after = after.counts;
  for (const name of Object.keys(before.counts).filter((name) => name !== "topics")) {
    if (before.counts[name] !== after.counts[name] || before.hashes[name] !== after.hashes[name]) summary.errors.push(`${name}: document count or protected content changed during migration; investigate concurrent writes`);
  }
  summary.remaining = await db.collection("flashcards").countDocuments(unassigned);
  summary.idempotent = !dryRun && summary.remaining === 0 && summary.errors.length === 0;
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(["--dry-run", "--apply", "--production-authorized"]);
  if (args.some((arg) => !allowed.has(arg)) || (args.includes("--apply") && args.includes("--dry-run"))) throw new Error("Use --dry-run (default) or --apply, optionally --production-authorized");
  const uri = process.env.TOPIC_MIGRATION_URI;
  const dbName = process.env.TOPIC_MIGRATION_DB;
  const environment = process.env.TOPIC_MIGRATION_ENV;
  if (!uri || !dbName || !["development", "test", "staging", "production"].includes(environment ?? "")) throw new Error("Set TOPIC_MIGRATION_URI, TOPIC_MIGRATION_DB and TOPIC_MIGRATION_ENV explicitly; app environment files are not loaded");
  if (environment === "production" && !args.includes("--production-authorized")) throw new Error("Production access requires explicit authorization and --production-authorized, including dry runs");
  try {
    await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const summary = await migrateTopics({ dryRun: !args.includes("--apply") });
    console.log(JSON.stringify({ database: dbName, environment, ...summary }, null, 2));
    if (summary.errors.length) process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`Topic migration failed: ${error.message}`); process.exitCode = 1; });
}
