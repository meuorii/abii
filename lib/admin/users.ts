import "server-only";
import { Types, type FilterQuery } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { User, ordinaryRoleFilter, type UserDocument } from "@/models/User";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { AchievementEvent } from "@/models/AchievementEvent";
import { type AccountCounts, type DirectoryUser, type UserDetail, type UsersPage, type UsersQuery,
  userSearchLimit, userSorts, userStatuses, userVerifications, validUserId } from "./users-contract";
import { openUsersToken, sealUsersToken } from "./users-tokens";

const maxTimeMS = 1500;
const pageSize = 20;
const smallDirectoryLimit = 50_000;
const projection = "_id name email profileImage createdAt emailVerifiedAt suspendedAt";
const nameCollation = { locale: "en", strength: 2 } as const;
type Lookup = FilterQuery<UserDocument>;
type Row = { _id: Types.ObjectId; name?: string; email?: string; profileImage?: string | null; createdAt?: Date; emailVerifiedAt?: Date | null; suspendedAt?: Date | null };
type Cursor = { id: string; sortValue: string | null; direction: "next" | "previous" };

export class UsersQueryError extends Error {}
export class UsersSearchUnavailable extends Error {}

export function parseUsersQuery(params: Record<string, string | string[] | undefined>) {
  if (Object.keys(params).some(key => !["q", "verification", "status", "sort", "cursor"].includes(key))) {
    throw new UsersQueryError("This directory link contains an unsupported option.");
  }
  function option<T extends string>(value: unknown, options: readonly T[]): T {
    if (value === undefined || value === "") return options[0];
    const selected = options.find(option => option === value);
    if (!selected) throw new UsersQueryError("Choose a supported filter or sort.");
    return selected;
  }
  if (params.q !== undefined && (typeof params.q !== "string" || params.q.length > userSearchLimit || /[\u0000-\u001F\u007F]/u.test(params.q))) {
    throw new UsersQueryError(`Enter a search of up to ${userSearchLimit} characters.`);
  }
  if (params.cursor !== undefined && typeof params.cursor !== "string") throw new UsersQueryError("This directory page link is invalid.");
  const query: UsersQuery = { q: params.q?.trim() ?? "", verification: option(params.verification, userVerifications),
    status: option(params.status, userStatuses), sort: option(params.sort, userSorts) };
  return { query, cursor: params.cursor };
}

function dateString(value: unknown) {
  return value instanceof Date && Number.isFinite(+value) ? value.toISOString() : null;
}

function safeProfileImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function projectUser(row: Row): DirectoryUser {
  return {
    id: row._id.toHexString(), name: typeof row.name === "string" ? row.name : "Unnamed user",
    email: typeof row.email === "string" ? row.email : "", profileImage: safeProfileImage(row.profileImage), joinedAt: dateString(row.createdAt),
    verifiedAt: dateString(row.emailVerifiedAt), suspendedAt: dateString(row.suspendedAt),
  };
}

export async function readAccountCounts(): Promise<AccountCounts> {
  await connectToDatabase();
  const [counts] = await User.aggregate<Omit<AccountCounts, "unverified">>([
    { $match: ordinaryRoleFilter },
    { $group: { _id: null, total: { $sum: 1 },
      verified: { $sum: { $cond: [{ $eq: [{ $type: "$emailVerifiedAt" }, "date"] }, 1, 0] } },
      suspended: { $sum: { $cond: [{ $eq: [{ $type: "$suspendedAt" }, "date"] }, 1, 0] } },
    } },
  ]).option({ maxTimeMS, allowDiskUse: false });
  const { total = 0, verified = 0, suspended = 0 } = counts ?? {};
  return { total, verified, suspended, unverified: total - verified };
}

const cursorContext = ({ q, verification, status, sort }: UsersQuery) => JSON.stringify(["directory", q, verification, status, sort]);

function readCursor(token: string, query: UsersQuery): Cursor {
  const cursor = openUsersToken(token, cursorContext(query)) as Partial<Cursor> | null;
  if (!cursor || typeof cursor.id !== "string" || !validUserId(cursor.id) ||
      (cursor.direction !== "next" && cursor.direction !== "previous") ||
      !(cursor.sortValue === null || (typeof cursor.sortValue === "string" &&
        (query.sort.startsWith("name") || dateString(new Date(cursor.sortValue)) === cursor.sortValue)))) {
    throw new UsersQueryError("This directory page link is invalid or expired.");
  }
  return { id: cursor.id, sortValue: cursor.sortValue, direction: cursor.direction };
}

function afterCursor(field: "name" | "createdAt", cursor: Cursor, direction: 1 | -1): Lookup {
  const { sortValue } = cursor;
  const id = new Types.ObjectId(cursor.id);
  const comparison = direction === 1 ? "$gt" : "$lt";
  const value = sortValue !== null && field === "createdAt" ? new Date(sortValue) : sortValue;
  const tie = { [field]: value, _id: { [comparison]: id } };
  // MongoDB range queries bracket by type. Missing and null both sort before valid values.
  if (value === null) return direction === 1 ? { $or: [tie, { [field]: { $type: field === "name" ? "string" : "date" } }] } : tie;
  const range = { [field]: { [comparison]: value } };
  return { $or: direction === 1 ? [range, tie] : [range, tie, { [field]: null }] };
}

export async function readUsersPage(query: UsersQuery, token?: string): Promise<UsersPage> {
  const cursor = token === undefined ? null : readCursor(token, query);
  const field = query.sort.startsWith("name") ? "name" : "createdAt";
  const direction = query.sort === "oldest" || query.sort === "name-asc" ? 1 : -1;
  const reverse = cursor?.direction === "previous";
  const scanDirection = reverse ? (direction === 1 ? -1 : 1) : direction;
  const clauses: Lookup[] = [ordinaryRoleFilter];
  // A name collation also applies to equality expressions. Keep role checks binary.
  if (field === "name") clauses.push({ $expr: { $or: [
    { $eq: [{ $type: "$role" }, "missing"] },
    { $regexMatch: { input: { $cond: [{ $eq: [{ $type: "$role" }, "string"] }, "$role", ""] }, regex: "\\Auser\\z" } },
  ] } });
  if (query.verification !== "all") {
    clauses.push({ $expr: { [query.verification === "verified" ? "$eq" : "$ne"]: [{ $type: "$emailVerifiedAt" }, "date"] } });
  }
  if (query.status === "suspended") clauses.push({ $expr: { $eq: [{ $type: "$suspendedAt" }, "date"] } });
  if (query.status === "active") clauses.push({ suspendedAt: null });
  if (query.q) {
    const prefix = `^${query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
    clauses.push({ $or: [{ name: { $regex: prefix, $options: "i" } }, { email: { $regex: prefix, $options: "i" } }] });
  }

  await connectToDatabase();
  const largeDirectory = await User.estimatedDocumentCount().maxTimeMS(maxTimeMS) > smallDirectoryLimit;
  if (largeDirectory && query.q) throw new UsersSearchUnavailable("Name and email search is unavailable at this directory size.");
  const filter = { $and: clauses };
  const match = cursor ? { $and: [...clauses, afterCursor(field, cursor, scanDirection)] } : filter;
  const find = User.find(match).select(projection).sort({ [field]: scanDirection, _id: scanDirection })
    .limit(pageSize + 1).lean().maxTimeMS(maxTimeMS);
  if (field === "name") find.collation(nameCollation);
  if (largeDirectory) find.hint(field === "name" ? "admin_users_name_id" : "admin_users_joined_id");
  function count(match: Lookup) {
    const count = User.countDocuments(match).maxTimeMS(maxTimeMS);
    if (field === "name") count.collation(nameCollation);
    return count.exec().catch(() => null);
  }
  const [found, total] = await Promise.all([find.exec(), count(filter)]);
  const more = found.length > pageSize;
  const visible = found.slice(0, pageSize);
  if (reverse) visible.reverse();
  function boundary(row: Row, direction: Cursor["direction"]): Cursor {
    const sortValue = field === "name" ? row.name ?? null : dateString(row.createdAt);
    return { id: row._id.toHexString(), sortValue, direction };
  }
  const first = visible.length ? boundary(visible[0], "previous") : null;
  const last = visible.length ? boundary(visible[visible.length - 1], "next") : null;
  const skipped = first && cursor && total !== null && !largeDirectory
    ? await count({ $and: [...clauses, afterCursor(field, first, direction === 1 ? -1 : 1)] })
    : cursor ? null : 0;
  return {
    rows: visible.map(projectUser), start: skipped === null ? null : skipped + 1, total,
    previous: first && (reverse ? more : skipped === null ? cursor : skipped > 0) ? sealUsersToken(first, cursorContext(query)) : null,
    next: last && (reverse || more) ? sealUsersToken(last, cursorContext(query)) : null,
  };
}

export async function readUserDetail(id: string): Promise<UserDetail | null> {
  if (!validUserId(id)) return null;
  await connectToDatabase();
  const account = await User.findOne({ _id: id, ...ordinaryRoleFilter }).select(`${projection} sessionVersion`).lean().maxTimeMS(maxTimeMS);
  if (!account) return null;
  const scope = { userId: account._id };
  const count = (query: { maxTimeMS: (budget: number) => PromiseLike<number> }) =>
    Promise.resolve(query.maxTimeMS(maxTimeMS)).catch(() => null);
  const [subjects, topics, flashcards, reviews, quizzes] = await Promise.all([
    count(Subject.countDocuments(scope)), count(Topic.countDocuments(scope)),
    count(Flashcard.countDocuments(scope)), count(ReviewRecord.countDocuments(scope)),
    // The canonical event writer uses one unique key per owner and completed quiz.
    count(AchievementEvent.countDocuments({ ...scope, kind: "quiz-completed", idempotencyKey: /^quiz-completed:[a-f0-9]{24}$/i })),
  ]);
  const user = projectUser(account);
  return { ...user, learning: { subjects, topics, flashcards, reviews, quizzes },
    revision: sealUsersToken({ version: account.sessionVersion ?? 0, action: user.suspendedAt ? "reactivate" : "suspend" }, `account:${id}`) };
}

export async function ordinaryUserExists(id: string) {
  return Boolean(await User.exists({ _id: id, ...ordinaryRoleFilter }).maxTimeMS(maxTimeMS));
}
