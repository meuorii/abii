import "server-only";
import mongoose, { Types, type ClientSession } from "mongoose";
import { Subject } from "../../models/Subject";
import { Topic, type TopicDocument, normalizeTopicName } from "../../models/Topic";
import { Flashcard } from "../../models/Flashcard";
import { TopicError, objectId, topicPayload, deletionPayload } from "./validation";

type Scope = { userId: Types.ObjectId; subjectId: Types.ObjectId };
type TopicRow = TopicDocument & { _id: Types.ObjectId };
function scopeFor(userId: string, subjectId: string): Scope {
  return { userId: new Types.ObjectId(objectId(userId)), subjectId: new Types.ObjectId(objectId(subjectId)) };
}
async function ownedSubject(scope: Scope, session: ClientSession | null = null) {
  if (!await Subject.exists({ _id: scope.subjectId, userId: scope.userId }).session(session)) throw new TopicError(404, "This subject could not be found.");
}
function publicTopic(topic: TopicRow, flashcardCount: number) {
  return { id: String(topic._id), subjectId: String(topic.subjectId), name: topic.name, description: topic.description ?? "", position: topic.position, createdAt: topic.createdAt.toISOString(), updatedAt: topic.updatedAt.toISOString(), flashcardCount, metrics: { flashcardCount } };
}
async function counts(scope: Scope) {
  const rows = await Flashcard.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { ...scope, topicId: { $ne: null } } }, { $group: { _id: "$topicId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

/** Every Topic mutation takes the same parent write lock; driver retries conflicts. */
async function mutate<T>(scope: Scope, action: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const parent = await Subject.updateOne({ _id: scope.subjectId, userId: scope.userId }, { $inc: { topicRevision: 1 } }, { session, timestamps: false });
      if (!parent.matchedCount) throw new TopicError(404, "This subject could not be found.");
      return action(session);
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }) as T;
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && (error.code === 20 || error.code === 303)) throw new TopicError(503, "Topic changes require a MongoDB replica set or sharded deployment with transactions. No changes were saved.");
    throw error;
  } finally { await session.endSession(); }
}
function checkVersion(topic: TopicRow, expected: string) {
  if (topic.updatedAt.toISOString() !== expected) throw new TopicError(409, "This topic changed. Reload it before trying again.");
}
function nextDate(previous: Date) { return new Date(Math.max(Date.now(), previous.getTime() + 1)); }
async function findTopic(scope: Scope, id: string, session: ClientSession | null = null) {
  const topic = await Topic.findOne({ ...scope, _id: objectId(id) }).session(session);
  if (!topic) throw new TopicError(404, "This topic could not be found.");
  return topic;
}

export async function listTopics(userId: string, subjectId: string) {
  const scope = scopeFor(userId, subjectId);
  await ownedSubject(scope);
  const [topics, totals] = await Promise.all([Topic.find(scope).sort({ position: 1, _id: 1 }).lean(), counts(scope)]);
  return topics.map((topic) => publicTopic(topic, totals.get(String(topic._id)) ?? 0));
}
export async function getTopic(userId: string, subjectId: string, topicId: string) {
  const scope = scopeFor(userId, subjectId);
  await ownedSubject(scope);
  const topic = await findTopic(scope, topicId);
  return publicTopic(topic, await Flashcard.countDocuments({ ...scope, topicId: topic._id }));
}
export async function createTopic(userId: string, subjectId: string, body: unknown) {
  const scope = scopeFor(userId, subjectId);
  const input = topicPayload(body, true);
  return mutate(scope, async (session) => {
    if (await Topic.exists({ ...scope, normalizedName: normalizeTopicName(input.name!) }).session(session)) throw new TopicError(409, "A topic with that name already exists in this subject.");
    const last = await Topic.findOne(scope).sort({ position: -1 }).session(session);
    const position = last ? last.position + 1 : 0;
    if (!Number.isSafeInteger(position)) throw new TopicError(409, "Topic ordering needs repair before another topic can be added.");
    const [topic] = await Topic.create([{ ...scope, ...input, position }], { session });
    return publicTopic(topic, 0);
  });
}
export async function updateTopic(userId: string, subjectId: string, topicId: string, body: unknown, expected: string) {
  const scope = scopeFor(userId, subjectId);
  objectId(topicId);
  const input = topicPayload(body, false);
  return mutate(scope, async (session) => {
    const topic = await findTopic(scope, topicId, session);
    checkVersion(topic, expected);
    if (input.name && await Topic.exists({ ...scope, _id: { $ne: topic._id }, normalizedName: normalizeTopicName(input.name) }).session(session)) throw new TopicError(409, "A topic with that name already exists in this subject.");
    if (input.position !== undefined) {
      const ordered = await Topic.find(scope).sort({ position: 1, _id: 1 }).session(session);
      if (input.position >= ordered.length) throw new TopicError(400, "Position must be within the subject's topic list.");
      const rest = ordered.filter((row) => !row._id.equals(topic._id));
      rest.splice(input.position, 0, topic);
      for (const [position, row] of rest.entries()) {
        if (row._id.equals(topic._id)) topic.position = position;
        else if (row.position !== position) {
          row.position = position;
          row.updatedAt = nextDate(row.updatedAt);
          await row.save({ session, timestamps: false });
        }
      }
    }
    if (input.name !== undefined) topic.name = input.name;
    if (input.description !== undefined) topic.description = input.description;
    topic.updatedAt = nextDate(topic.updatedAt);
    await topic.save({ session, timestamps: false });
    return publicTopic(topic, await Flashcard.countDocuments({ ...scope, topicId: topic._id }).session(session));
  });
}
export async function deleteTopic(userId: string, subjectId: string, topicId: string, body: unknown, expected: string) {
  const scope = scopeFor(userId, subjectId);
  objectId(topicId);
  const destinationId = deletionPayload(body);
  if (destinationId?.toLowerCase() === topicId.toLowerCase()) throw new TopicError(400, "Choose a different destination topic.");
  return mutate(scope, async (session) => {
    const source = await findTopic(scope, topicId, session);
    checkVersion(source, expected);
    const destination = destinationId ? await findTopic(scope, destinationId, session) : null;
    const filter = { ...scope, topicId: source._id };
    const count = await Flashcard.countDocuments(filter).session(session);
    if (count && !destination) throw new TopicError(409, "This topic contains flashcards. Choose a destination topic in this subject.");
    let movedFlashcardCount = 0;
    if (destination) {
      const result = await Flashcard.updateMany(filter, { $set: { topicId: destination._id } }, { session, timestamps: false });
      movedFlashcardCount = result.modifiedCount;
      destination.updatedAt = nextDate(destination.updatedAt);
      await destination.save({ session, timestamps: false });
    }
    // Also refuse malformed cross-owner references rather than leaving dangling cards.
    if (await Flashcard.exists({ topicId: source._id }).session(session)) throw new TopicError(409, "The source still has flashcards; no changes were saved.");
    await Topic.deleteOne({ ...scope, _id: source._id }, { session });
    return { success: true, movedFlashcardCount };
  });
}
