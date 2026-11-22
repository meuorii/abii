import "server-only";
import { randomBytes } from "node:crypto";
import { Admin, ADMIN_ID, ADMIN_SUBJECT } from "@/models/Admin";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";
import { connectToDatabase } from "@/lib/mongodb";
import { checkAuthRateLimit } from "./rate-limit";
import { auditAdmin, recordAdminDenial, requireAdminAuditStorage } from "./admin-audit";
import { assertNoLegacyAdmin, readActiveAdmin, readAdmin } from "./admin-identity";
import { acceptedStep, digest, prepareEnrollment } from "./admin-factor-crypto";

type Credential = { recoveryCode: string } | { totp: string };
const id = { _id: ADMIN_ID };
const active = { ...id, status: "active" as const };
const pending = { ...id, status: "pending" as const };
const clearChallenge = { "mfa.challengeHash": "", "mfa.challengeVersion": "", "mfa.challengeExpiresAt": "" };
export const ADMIN_LIFETIME = 1800;
export const ADMIN_CHALLENGE_LIFETIME = 300;

export class AdminFactorRateLimitError extends Error {
  constructor() { super("Too many attempts. Please try again later."); }
}

async function limit(scope: string) {
  if (!await checkAuthRateLimit("admin-" + scope, ADMIN_SUBJECT, 8, 5 * 60_000)) throw new AdminFactorRateLimitError();
}

export function pendingFactor(enrollment: ReturnType<typeof prepareEnrollment>) {
  return {
    encryptedSeed: enrollment.encryptedSeed, proofHash: enrollment.proofHash,
    enrollmentExpiresAt: enrollment.expiresAt, lastStep: -1, completedChallenges: [],
  };
}

export async function confirmEnrollment(proof: string, code: string) {
  await requireAdminAuditStorage();
  await limit("enroll");
  return withRequiredTransaction(async session => {
    await assertNoLegacyAdmin(session);
    const row = await readAdmin(session);
    const proofHash = digest(proof);
    if (row?.status !== "pending" || row.mfa.proofHash !== proofHash ||
        !row.mfa.enrollmentExpiresAt || row.mfa.enrollmentExpiresAt <= new Date()) return null;
    const step = acceptedStep(ADMIN_SUBJECT, row.mfa.encryptedSeed, code, row.mfa.lastStep);
    if (step === null) return null;
    const codes = Array.from({ length: 8 }, () => randomBytes(20).toString("hex"));
    const changed = await Admin.updateOne({
      ...pending, sessionVersion: row.sessionVersion,
      "mfa.proofHash": proofHash, "mfa.enrollmentExpiresAt": { $gt: new Date() },
    }, {
      $set: { status: "active", "mfa.lastStep": step, recoveryCodes: codes.map(digest) },
      $unset: { "mfa.proofHash": "", "mfa.enrollmentExpiresAt": "" },
    }, { session, runValidators: true });
    if (!changed.modifiedCount) return null;
    await auditAdmin("enroll", ADMIN_SUBJECT, ADMIN_SUBJECT, session);
    return codes;
  });
}

export type EnrollmentRestartStage = "restart audit storage" | "restart rate limit" | "restart transaction" |
  "restart account recheck" | "restart factor update" | "restart audit write" | "restart transaction commit";

/** Private CLI only, after verifying the original password. */
export async function restartPendingEnrollment(expectedVersion: number, onStage?: (stage: EnrollmentRestartStage) => void) {
  onStage?.("restart audit storage");
  await requireAdminAuditStorage();
  onStage?.("restart rate limit");
  await limit("restart");
  onStage?.("restart transaction");
  return withRequiredTransaction(async session => {
    onStage?.("restart account recheck");
    await assertNoLegacyAdmin(session);
    const row = await readAdmin(session);
    if (row?.status !== "pending" || row.sessionVersion !== expectedVersion) return null;
    onStage?.("restart factor update");
    const enrollment = prepareEnrollment(ADMIN_SUBJECT);
    const replaced = await Admin.updateOne({
      ...pending, sessionVersion: expectedVersion, "mfa.enrollmentExpiresAt": { $lte: new Date() },
    }, { $set: { mfa: pendingFactor(enrollment) } }, { session, runValidators: true });
    if (!replaced.modifiedCount) return null;
    onStage?.("restart audit write");
    await auditAdmin("enrollment-restart", ADMIN_SUBJECT, ADMIN_SUBJECT, session);
    onStage?.("restart transaction commit");
    return { seed: enrollment.seed, proof: enrollment.proof };
  });
}

/** Only the password verifier may issue an opaque, browser-held challenge. */
export async function startAdminChallenge(version: number) {
  await connectToDatabase();
  const row = await readActiveAdmin();
  if (!row || row.sessionVersion !== version) return null;
  await requireAdminAuditStorage();
  await limit("challenge");
  const token = randomBytes(32).toString("base64url");
  const changed = await Admin.updateOne({ ...active, sessionVersion: version }, { $set: {
    "mfa.challengeHash": digest(token), "mfa.challengeVersion": version,
    "mfa.challengeExpiresAt": new Date(Date.now() + ADMIN_CHALLENGE_LIFETIME * 1000),
  } }, { runValidators: true });
  return changed.modifiedCount ? token : null;
}

export async function revokeAdminChallenge(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return;
  await requireAdminAuditStorage();
  const hash = digest(token);
  await withRequiredTransaction(async session => {
    // Completion, cancellation and version changes all write the singleton.
    const canceled = await Admin.updateOne({ ...id, "mfa.challengeHash": hash }, { $unset: clearChallenge }, { session });
    if (canceled.modifiedCount) return;
    const row = await Admin.findOne({ ...id, "mfa.completedChallenges": { $elemMatch: { hash, expiresAt: { $gt: new Date() } } } })
      .select("+mfa sessionVersion").session(session).lean();
    if (!row?.mfa.completedChallenges.some(item => item.hash === hash && item.version === row.sessionVersion && item.expiresAt > new Date())) return;
    const changed = await Admin.updateOne({ ...id, sessionVersion: row.sessionVersion },
      { $inc: { sessionVersion: 1 } }, { session });
    if (changed.modifiedCount) await auditAdmin("logout", ADMIN_SUBJECT, ADMIN_SUBJECT, session);
  });
}

export async function verifyAdminChallenge(token: string, code: string) {
  if (!/^[\w-]{43}$/.test(token) || !/^\d{6}$/.test(code)) return null;
  await connectToDatabase();
  const challengeHash = digest(token);
  const filter = { ...active, "mfa.challengeHash": challengeHash };
  if (!await Admin.exists(filter).read("primary")) return null;
  await requireAdminAuditStorage();
  await limit("verify");
  const result = await withRequiredTransaction(async session => {
    const row = await readActiveAdmin(session);
    if (!row || row.mfa.challengeHash !== challengeHash || row.mfa.challengeVersion !== row.sessionVersion ||
        !row.mfa.challengeExpiresAt || row.mfa.challengeExpiresAt <= new Date()) return null;
    const step = acceptedStep(ADMIN_SUBJECT, row.mfa.encryptedSeed, code, row.mfa.lastStep);
    if (step === null) return null;
    const authenticatedAt = Math.floor(Date.now() / 1000);
    const version = row.sessionVersion;
    const completedChallenges = row.mfa.completedChallenges
      .filter(item => item.version === version && item.expiresAt.getTime() > authenticatedAt * 1000)
      .map(({ hash, version, expiresAt }) => ({ hash, version, expiresAt }));
    // Keep the digest through the JWT lifetime to revoke a response racing logout.
    completedChallenges.push({ hash: challengeHash, version, expiresAt: new Date((authenticatedAt + ADMIN_LIFETIME) * 1000) });
    const changed = await Admin.updateOne({
      ...filter, sessionVersion: version, "mfa.lastStep": { $lt: step },
      "mfa.challengeExpiresAt": { $gt: new Date() },
    }, {
      $set: { "mfa.lastStep": step, "mfa.completedChallenges": completedChallenges, lastLoginAt: new Date(authenticatedAt * 1000) },
      $unset: clearChallenge,
    }, { session, runValidators: true });
    if (!changed.modifiedCount) return null;
    await auditAdmin("login", ADMIN_SUBJECT, ADMIN_SUBJECT, session);
    return { version, authenticatedAt };
  });
  if (!result) await recordAdminDenial("mfa-denied");
  return result;
}

/** Recovery codes are operator-only and consumed by replacing the entire factor and code set. */
export async function replaceAdminFactor(credential: Credential, expectedVersion: number, newPasswordHash?: string) {
  await requireAdminAuditStorage();
  await limit("recover");
  const result = await withRequiredTransaction(async session => {
    const usingRecovery = "recoveryCode" in credential;
    await assertNoLegacyAdmin(session);
    const row = await readAdmin(session, { allowUnreadableFactor: usingRecovery });
    if (row?.status !== "active" || row.sessionVersion !== expectedVersion) return null;
    if (usingRecovery) {
      if (!/^[0-9a-f]{40}$/.test(credential.recoveryCode) || !row.recoveryCodes.includes(digest(credential.recoveryCode))) return null;
    } else if (acceptedStep(ADMIN_SUBJECT, row.mfa.encryptedSeed, credential.totp, row.mfa.lastStep) === null) {
      return null;
    }
    const enrollment = prepareEnrollment(ADMIN_SUBJECT);
    const changed = await Admin.updateOne({ ...active, sessionVersion: expectedVersion }, {
      $set: { status: "pending", mfa: pendingFactor(enrollment), recoveryCodes: [], ...(newPasswordHash ? { passwordHash: newPasswordHash } : {}) },
      $inc: { sessionVersion: 1 },
    }, { session, runValidators: true });
    if (!changed.modifiedCount) return null;
    await auditAdmin(usingRecovery ? "recover" : "rotate", ADMIN_SUBJECT, ADMIN_SUBJECT, session);
    return { seed: enrollment.seed, proof: enrollment.proof };
  });
  if (!result) await recordAdminDenial("recovery-denied");
  return result;
}
