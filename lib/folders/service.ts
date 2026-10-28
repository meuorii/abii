import "server-only";
import { Types } from "mongoose";
import { Folder, normalizeFolderName } from "../../models/Folder";
import { Topic } from "../../models/Topic";
import { Flashcard } from "../../models/Flashcard";
import { Subject } from "../../models/Subject";
import { mutate } from "../topics/service";
import { TopicError, objectId } from "../topics/validation";

function scope(userId: string, subjectId: string) { return { userId: new Types.ObjectId(objectId(userId)), subjectId: new Types.ObjectId(objectId(subjectId)) }; }
function payload(body: unknown, create: boolean) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TopicError(400, "Provide a JSON object.");
  const data = body as Record<string, unknown>;
  if (!Object.keys(data).length || Object.keys(data).some(k => !["name", "description", ...(create ? [] : ["position"])].includes(k))) throw new TopicError(400, "Unsupported or empty folder fields.");
  const out: { name?: string; description?: string; position?: number } = {};
  if (create || "name" in data) {
    if (typeof data.name !== "string") throw new TopicError(400, "Folder name is required.");
    out.name = data.name.normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (!out.name || out.name.length > 100) throw new TopicError(400, "Use a folder name between 1 and 100 characters.");
  }
  if ("description" in data) { if (typeof data.description !== "string" || data.description.length > 500) throw new TopicError(400, "Description must be at most 500 characters."); out.description = data.description.trim(); }
  if ("position" in data) { if (typeof data.position !== "number" || !Number.isSafeInteger(data.position) || data.position < 0) throw new TopicError(400, "Invalid position."); out.position = data.position; }
  return out;
}
function serialize(f: { _id: Types.ObjectId; subjectId: Types.ObjectId; name: string; description?: string; position: number; createdAt: Date; updatedAt: Date }, topicCount = 0, flashcardCount = 0) { return { id: String(f._id), subjectId: String(f.subjectId), name: f.name, description: f.description ?? "", position: f.position, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString(), topicCount, flashcardCount }; }
export async function listFolders(userId: string, subjectId: string) {
  const s = scope(userId, subjectId);
  if (!await Subject.exists({ _id: s.subjectId, userId: s.userId })) throw new TopicError(404, "This subject could not be found.");
  const [folders, topics, cards] = await Promise.all([Folder.find(s).sort({ position: 1, _id: 1 }).lean(), Topic.find({ ...s, folderId: { $ne: null } }).select("folderId").lean(), Flashcard.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { ...s, topicId: { $ne: null } } }, { $group: { _id: "$topicId", count: { $sum: 1 } } }])]);
  const cardCounts = new Map(cards.map(c => [String(c._id), c.count]));
  const totals = new Map<string, { topics: number; cards: number }>();
  for (const topic of topics) { const id = String(topic.folderId); const total = totals.get(id) ?? { topics: 0, cards: 0 }; total.topics++; total.cards += cardCounts.get(String(topic._id)) ?? 0; totals.set(id, total); }
  return folders.map(f => { const total = totals.get(String(f._id)); return serialize(f, total?.topics, total?.cards); });
}
export async function unfiledSummary(userId: string, subjectId: string) {
  const s = scope(userId, subjectId);
  if (!await Subject.exists({ _id: s.subjectId, userId: s.userId })) throw new TopicError(404, "This subject could not be found.");
  const [topicCount, flashcards] = await Promise.all([
    Topic.countDocuments({ ...s, $or: [{ folderId: null }, { folderId: { $exists: false } }] }),
    Flashcard.countDocuments({ ...s, topicId: { $in: await Topic.find({ ...s, $or: [{ folderId: null }, { folderId: { $exists: false } }] }).distinct("_id") } }),
  ]);
  return { topicCount, flashcardCount: flashcards };
}
export async function createFolder(userId: string, subjectId: string, body: unknown) {
  const s = scope(userId, subjectId), input = payload(body, true);
  return mutate(s, async session => {
    if (await Folder.exists({ ...s, normalizedName: normalizeFolderName(input.name!) }).session(session)) throw new TopicError(409, "A folder with that name already exists in this subject.");
    const last = await Folder.findOne(s).sort({ position: -1 }).session(session);
    const position = last ? last.position + 1 : 0;
    if (!Number.isSafeInteger(position)) throw new TopicError(409, "Folder ordering needs repair.");
    const [folder] = await Folder.create([{ ...s, ...input, position }], { session }); return serialize(folder);
  });
}
export async function changeFolder(userId: string, subjectId: string, id: string, body: unknown, expected: string, remove = false) {
  const s = scope(userId, subjectId); objectId(id);
  let input: ReturnType<typeof payload> = {};
  if (remove) { if (!body || typeof body !== "object" || Array.isArray(body) || (body as Record<string, unknown>).confirm !== true || Object.keys(body).length !== 1) throw new TopicError(400, "Confirm deletion with confirm: true."); } else input = payload(body, false);
  return mutate(s, async session => {
    const folder = await Folder.findOne({ ...s, _id: id }).session(session);
    if (!folder) throw new TopicError(404, "This folder could not be found.");
    if (folder.updatedAt.toISOString() !== expected) throw new TopicError(409, "This folder changed. Reload it before trying again.");
    if (remove) {
      const topics = await Topic.find({ ...s, folderId: folder._id }).session(session);
      for (const topic of topics) {
        topic.folderId = null;
        topic.updatedAt = new Date(Math.max(Date.now(), topic.updatedAt.getTime() + 1));
        await topic.save({ session, timestamps: false });
      }
      if (await Topic.exists({ folderId: folder._id }).session(session)) throw new TopicError(409, "Folder contains invalid references. No changes were saved.");
      await Folder.deleteOne({ ...s, _id: folder._id }, { session }); return { success: true, movedTopicCount: topics.length };
    }
    if (input.name && await Folder.exists({ ...s, _id: { $ne: folder._id }, normalizedName: normalizeFolderName(input.name) }).session(session)) throw new TopicError(409, "A folder with that name already exists in this subject.");
    if (input.position !== undefined) {
      const rows = await Folder.find(s).sort({ position: 1, _id: 1 }).session(session);
      if (input.position >= rows.length) throw new TopicError(400, "Position must be within the folder list.");
      const rest = rows.filter(row => !row._id.equals(folder._id)); rest.splice(input.position, 0, folder);
      for (const [position, row] of rest.entries()) if (row.position !== position) { row.position = position; if (!row._id.equals(folder._id)) { row.updatedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)); await row.save({ session, timestamps: false }); } }
    }
    if (input.name !== undefined) folder.name = input.name;
    if (input.description !== undefined) folder.description = input.description;
    folder.updatedAt = new Date(Math.max(Date.now(), folder.updatedAt.getTime() + 1)); await folder.save({ session, timestamps: false });
    return serialize(folder);
  });
}
