import "server-only";
import { Types } from "mongoose";
import { SubjectFolder, normalizeSubjectFolderName } from "@/models/SubjectFolder";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";
import { Flashcard } from "@/models/Flashcard";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";
import { folderId, folderPayload, SubjectFolderError } from "./validation";

const oid = (value: string) => new Types.ObjectId(value);
const scope = (userId: string) => ({ userId: oid(userId) });
export async function listSubjectFolders(userId: string) {
  const s = scope(userId);
  const [folders, subjects, topics, cards] = await Promise.all([
    SubjectFolder.find(s).sort({ position: 1, _id: 1 }).lean(),
    Subject.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { ...s, subjectFolderId: { $ne: null } } }, { $group: { _id: "$subjectFolderId", count: { $sum: 1 } } }]),
    Subject.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { ...s, subjectFolderId: { $ne: null } } }, { $lookup: { from: Topic.collection.name, let: { subjectKey: "$_id", ownerKey: "$userId" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$subjectId", "$$subjectKey"] }, { $eq: ["$userId", "$$ownerKey"] }] } } }], as: "topics" } }, { $unwind: "$topics" }, { $group: { _id: "$subjectFolderId", count: { $sum: 1 } } }]),
    Subject.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { ...s, subjectFolderId: { $ne: null } } }, { $lookup: { from: Flashcard.collection.name, let: { subjectKey: "$_id", ownerKey: "$userId" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$subjectId", "$$subjectKey"] }, { $eq: ["$userId", "$$ownerKey"] }] } } }], as: "cards" } }, { $unwind: "$cards" }, { $group: { _id: "$subjectFolderId", count: { $sum: 1 } } }]),
  ]);
  const toMap = (rows: { _id: Types.ObjectId; count: number }[]) => new Map(rows.map(row => [String(row._id), row.count]));
  const subjectCounts = toMap(subjects), topicCounts = toMap(topics), flashcardCounts = toMap(cards);
  return folders.map(folder => ({ id: String(folder._id), name: folder.name, description: folder.description ?? "", position: folder.position, createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString(), subjectCount: subjectCounts.get(String(folder._id)) ?? 0, topicCount: topicCounts.get(String(folder._id)) ?? 0, flashcardCount: flashcardCounts.get(String(folder._id)) ?? 0 }));
}
export async function getSubjectFolder(userId: string, id: string) {
  folderId(id);
  const folder = (await listSubjectFolders(userId)).find(item => item.id === id.toLowerCase());
  if (!folder) throw new SubjectFolderError(404, "This subject folder could not be found.");
  return folder;
}
export async function createSubjectFolder(userId: string, body: unknown) {
  const input = folderPayload(body, true), s = scope(userId);
  const duplicate = await SubjectFolder.exists({ ...s, normalizedName: normalizeSubjectFolderName(input.name!) });
  if (duplicate) throw new SubjectFolderError(409, "A subject folder with that name already exists.");
  const last = await SubjectFolder.findOne(s).sort({ position: -1 }).select("position").lean();
  const folder = await SubjectFolder.create({ ...s, ...input, normalizedName: normalizeSubjectFolderName(input.name!), position: last ? last.position + 1 : 0 });
  return { id: String(folder._id), name: folder.name, description: folder.description ?? "", position: folder.position, createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString(), subjectCount: 0, topicCount: 0, flashcardCount: 0 };
}
export async function changeSubjectFolder(userId: string, id: string, body: unknown, expected: string, remove = false) {
  folderId(id);
  const s = scope(userId), input = remove ? {} : folderPayload(body);
  if (remove && (!body || typeof body !== "object" || Array.isArray(body) || (body as Record<string, unknown>).confirm !== true || Object.keys(body).length !== 1)) throw new SubjectFolderError(400, "Confirm deletion with confirm: true.");
  return withRequiredTransaction(async session => {
    const folder = await SubjectFolder.findOne({ ...s, _id: id }).session(session);
    if (!folder) throw new SubjectFolderError(404, "This subject folder could not be found.");
    if (folder.updatedAt.toISOString() !== expected) throw new SubjectFolderError(409, "This folder changed. Reload it before trying again.");
    if (remove) {
      const moved = await Subject.updateMany({ ...s, subjectFolderId: folder._id }, { $set: { subjectFolderId: null } }, { session });
      await SubjectFolder.deleteOne({ ...s, _id: folder._id }, { session });
      return { success: true as const, movedSubjectCount: moved.modifiedCount };
    }
    if (input.name && await SubjectFolder.exists({ ...s, _id: { $ne: folder._id }, normalizedName: normalizeSubjectFolderName(input.name) }).session(session)) throw new SubjectFolderError(409, "A subject folder with that name already exists.");
    if (input.position !== undefined) {
      const rows = await SubjectFolder.find(s).sort({ position: 1, _id: 1 }).session(session);
      if (input.position >= rows.length) throw new SubjectFolderError(400, "Position must be within the folder list.");
      const rest = rows.filter(row => !row._id.equals(folder._id)); rest.splice(input.position, 0, folder);
      for (const [position, row] of rest.entries()) { if (row.position !== position) row.position = position; if (row.isModified()) { row.updatedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)); await row.save({ session, timestamps: false }); } }
    }
    if (input.name !== undefined) { folder.name = input.name; folder.normalizedName = normalizeSubjectFolderName(input.name); }
    if (input.description !== undefined) folder.description = input.description;
    folder.updatedAt = new Date(Math.max(Date.now(), folder.updatedAt.getTime() + 1)); await folder.save({ session, timestamps: false });
    return { id: String(folder._id), name: folder.name, description: folder.description ?? "", position: folder.position, createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString() };
  });
}
