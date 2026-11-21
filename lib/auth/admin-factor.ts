import "server-only";
import { randomBytes } from "node:crypto";
import { type ClientSession, Types } from "mongoose";
import { AdminFactor } from "@/models/AdminFactor";
import { activeAdminAccount, User } from "@/models/User";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";
import { connectToDatabase } from "@/lib/mongodb";
import { checkAuthRateLimit } from "./rate-limit";
import { auditAdmin, recordAdminDenial } from "./admin-audit";
import { acceptedStep, digest, prepareEnrollment, readSeed } from "./admin-factor-crypto";

export { prepareEnrollment };
type Enrollment = ReturnType<typeof prepareEnrollment>;
type Credential = { recoveryCode: string } | { totp: string };

const adminState = activeAdminAccount;
const clearChallenge = { challengeHash: "", challengeVersion: "", challengeExpiresAt: "" };
export const ADMIN_LIFETIME = 1800;

export class AdminFactorRateLimitError extends Error {
  constructor() { super("Too many attempts. Please try again later."); }
}

async function limit(scope: string, id: string) {
  if (!await checkAuthRateLimit("admin-" + scope, id, 8, 5 * 60_000)) throw new AdminFactorRateLimitError();
}

function pending(enrollment: Enrollment, enrollmentVersion: number) {
  return {
    state: "pending" as const, encryptedSeed: enrollment.encryptedSeed,
    proofHash: enrollment.proofHash, enrollmentExpiresAt: enrollment.expiresAt, enrollmentVersion,
    lastStep: -1, recoveryHashes: [], completedChallenges: [],
  };
}

/** Called by the private operator during the same transaction that creates the identity. */
export async function installPendingEnrollment(userId: string, enrollment: Enrollment, session: ClientSession) {
  if (!session.inTransaction()) throw new Error("Enrollment requires an active transaction.");
  const user = await User.findOne({ _id: userId, ...adminState }).select("sessionVersion").session(session).lean();
  if (!user) throw new Error("Verified administrator required for enrollment.");
  await AdminFactor.create([{ _id: new Types.ObjectId(userId), ...pending(enrollment, user.sessionVersion) }], { session });
}

export async function hasAdminFactor(userId: string) {
  await connectToDatabase();
  const row = await AdminFactor.findOne({ _id: userId, state: "active" }).select("+encryptedSeed").lean();
  if (!row) return false;
  // Detect key loss or damaged authenticated ciphertext during privileged identity validation.
  readSeed(userId, row.encryptedSeed);
  return true;
}

export async function confirmEnrollment(userId: string, proof: string, code: string) {
  await limit("enroll", userId);
  const proofHash = digest(proof);
  return withRequiredTransaction(async session => {
    const now = new Date();
    const filter = { _id: userId, state: "pending", proofHash, enrollmentExpiresAt: { $gt: now } };
    const row = await AdminFactor.findOne(filter).session(session).select("+encryptedSeed").lean();
    if (!row || typeof row.enrollmentVersion !== "number" ||
        !await User.exists({ _id: userId, sessionVersion: row.enrollmentVersion, ...adminState }).session(session)) return null;
    const step = acceptedStep(userId, row.encryptedSeed, code, row.lastStep);
    if (step === null) return null;
    const codes = Array.from({ length: 8 }, () => randomBytes(20).toString("hex"));
    const changed = await AdminFactor.updateOne(filter, { $set: {
      state: "active", lastStep: step, recoveryHashes: codes.map(digest),
    }, $unset: { proofHash: "", enrollmentExpiresAt: "", enrollmentVersion: "" } }, { session });
    if (!changed.modifiedCount) return null;
    await auditAdmin("enroll", userId, userId, session);
    return codes;
  });
}

/** CLI-only. Requires private operator identity verification before issuing a replacement. */
export async function restartPendingEnrollment(userId: string, expectedVersion: number) {
  await limit("restart", userId);
  return withRequiredTransaction(async session => {
    if (!await User.exists({ _id: userId, sessionVersion: expectedVersion, ...adminState }).session(session)) return null;
    const enrollment = prepareEnrollment(userId);
    const replaced = await AdminFactor.updateOne({
      _id: userId, state: "pending", enrollmentExpiresAt: { $lte: new Date() },
    }, { $set: pending(enrollment, expectedVersion) }, { session });
    if (!replaced.modifiedCount) return null;
    await auditAdmin("enrollment-restart", userId, userId, session);
    return { seed: enrollment.seed, proof: enrollment.proof };
  });
}

/** Only the password verifier may issue an opaque, browser-held, single-use challenge. */
export async function startAdminChallenge(userId: string, version: number) {
  await limit("challenge", userId);
  if (!await User.exists({ _id: userId, sessionVersion: version, ...adminState })) return null;
  const token = randomBytes(32).toString("base64url");
  const changed = await AdminFactor.updateOne({ _id: userId, state: "active" }, { $set: {
    challengeHash: digest(token), challengeVersion: version, challengeExpiresAt: new Date(Date.now() + 300_000),
  } });
  return changed.modifiedCount ? token : null;
}

export async function cancelAdminChallenge(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return;
  await connectToDatabase();
  await AdminFactor.updateOne({ challengeHash: digest(token) }, { $unset: clearChallenge });
}

export async function revokeAdminChallenge(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return;
  await connectToDatabase();
  const hash = digest(token);
  await withRequiredTransaction(async session => {
    // Completion and cancellation write the same factor row, so a conflict retries against the winner.
    const canceled = await AdminFactor.updateOne({ challengeHash: hash }, { $unset: clearChallenge }, { session });
    if (canceled.modifiedCount) return;

    const live = { hash, expiresAt: { $gt: new Date() } };
    const factor = await AdminFactor.findOne({ state: "active", completedChallenges: { $elemMatch: live } })
      .select({ completedChallenges: { $elemMatch: live } }).session(session).lean();
    const completed = factor?.completedChallenges?.[0];
    if (!factor || !completed) return;
    const changed = await User.updateOne({ ...adminState, _id: factor._id, sessionVersion: completed.version },
      { $inc: { sessionVersion: 1 } }, { session });
    if (changed.modifiedCount) await auditAdmin("logout", String(factor._id), String(factor._id), session);
  });
}

export async function verifyAdminChallenge(token: string, code: string) {
  if (!/^[\w-]{43}$/.test(token) || !/^\d{6}$/.test(code)) return null;
  await connectToDatabase();
  const filter = { challengeHash: digest(token), state: "active" };
  const owner = await AdminFactor.findOne(filter).select("_id").lean();
  if (!owner) return null;
  const userId = String(owner._id);
  await limit("verify", userId);
  const result = await withRequiredTransaction(async session => {
    const current = { ...filter, _id: owner._id, challengeExpiresAt: { $gt: new Date() } };
    const row = await AdminFactor.findOne(current).select("+encryptedSeed +completedChallenges").session(session).lean();
    if (!row || typeof row.challengeVersion !== "number") return null;
    const version = row.challengeVersion;
    if (!await User.exists({ _id: owner._id, sessionVersion: version, ...adminState }).session(session)) return null;
    const step = acceptedStep(userId, row.encryptedSeed, code, row.lastStep);
    if (step === null) return null;
    const authenticatedAt = Math.floor(Date.now() / 1000);
    const completedChallenges: { hash: string; version: number; expiresAt: Date }[] = (row.completedChallenges ?? []).filter(item =>
      item.version === version && item.expiresAt.getTime() > authenticatedAt * 1000);
    // Keep the digest through the JWT lifetime even if a later login replaces the pending slot.
    completedChallenges.push({ hash: filter.challengeHash, version, expiresAt: new Date((authenticatedAt + ADMIN_LIFETIME) * 1000) });
    const changed = await AdminFactor.updateOne({ ...current, lastStep: { $lt: step } },
      { $set: { lastStep: step, completedChallenges }, $unset: clearChallenge }, { session });
    if (!changed.modifiedCount) return null;
    await auditAdmin("login", userId, userId, session);
    return { userId, version, authenticatedAt };
  });
  if (!result) await recordAdminDenial("mfa-denied", userId);
  return result;
}

/** Operator-only credential recovery after independent identity checks. No session is issued. */
export async function replaceAdminFactor(userId: string, credential: Credential, expectedVersion: number, newPasswordHash?: string) {
  await limit("recover", userId);
  const result = await withRequiredTransaction(async session => {
    const row = await AdminFactor.findOne({ _id: userId, state: "active" }).select("+encryptedSeed").session(session).lean();
    if (!row) return null;
    const usingRecovery = "recoveryCode" in credential;
    const step = usingRecovery ? null : acceptedStep(userId, row.encryptedSeed, credential.totp, row.lastStep);
    if (usingRecovery ? !/^[0-9a-f]{40}$/.test(credential.recoveryCode) : step === null) return null;
    const identity = { _id: userId, sessionVersion: expectedVersion, ...adminState };
    if (!await User.exists(identity).session(session)) return null;
    const enrollment = prepareEnrollment(userId);
    const condition = usingRecovery ? { recoveryHashes: digest(credential.recoveryCode) } : { lastStep: { $lt: step! } };
    const changed = await AdminFactor.updateOne({ _id: userId, state: "active", ...condition },
      { $set: pending(enrollment, expectedVersion + 1), $unset: clearChallenge }, { session });
    if (!changed.modifiedCount) return null;
    const updated = await User.updateOne(identity, {
      $inc: { sessionVersion: 1 }, ...(newPasswordHash ? { $set: { passwordHash: newPasswordHash } } : {}),
    }, { session });
    if (!updated.modifiedCount) throw new Error("Administrator state changed during recovery.");
    await auditAdmin(usingRecovery ? "recover" : "rotate", userId, userId, session);
    return { seed: enrollment.seed, proof: enrollment.proof };
  });
  if (!result) await recordAdminDenial("recovery-denied", userId);
  return result;
}
