export const usersPath = "/admin/users";
export const userSorts = ["newest", "oldest", "name-asc", "name-desc"] as const;
export const userVerifications = ["all", "verified", "unverified"] as const;
export const userStatuses = ["all", "active", "suspended"] as const;
export const userSearchLimit = 100;
export const reasonMin = 3;
export const reasonMax = 500;

export type UsersQuery = {
  q: string;
  verification: typeof userVerifications[number];
  status: typeof userStatuses[number];
  sort: typeof userSorts[number];
};

export type AccountCounts = { total: number; verified: number; unverified: number; suspended: number };
export type DirectoryUser = { id: string; name: string; email: string; joinedAt: string | null; verifiedAt: string | null; suspendedAt: string | null };
export type UsersPage = { rows: DirectoryUser[]; total: number | null; start: number | null; previous: string | null; next: string | null };
export type LearningCounts = Record<"subjects" | "topics" | "flashcards" | "reviews" | "quizzes", number | null>;
export type UserDetail = DirectoryUser & { learning: LearningCounts; revision: string };
export type AccountChange = { action: "suspend" | "reactivate"; reason: string; revision: string };
export type AccountChangeResult = { message: string; code?: "stale" | "reauthenticate" | "unconfirmed" };

export function usersHref(query: UsersQuery, cursor?: string | null) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.verification !== "all") params.set("verification", query.verification);
  if (query.status !== "all") params.set("status", query.status);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (cursor) params.set("cursor", cursor);
  const search = params.toString();
  return search ? `${usersPath}?${search}` : usersPath;
}

export function validUserId(value: string) {
  return /^[a-f0-9]{24}$/.test(value);
}

export function accountReason(value: unknown) {
  if (typeof value !== "string" || value.length > reasonMax || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)) return null;
  const trimmed = value.trim();
  return trimmed.length >= reasonMin ? trimmed : null;
}
