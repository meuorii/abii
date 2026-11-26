import "server-only";
import type { ClientSession } from "mongoose";
import { Admin, ADMIN_EMAIL_PATTERN, ADMIN_ID, ADMIN_PASSWORD_HASH, ADMIN_SUBJECT, SHA256_HEX, type AdminRecord } from "@/models/Admin";
import { User } from "@/models/User";
import { readSeed } from "./admin-factor-crypto";
import { normalizeEmail } from "./validation";

const insensitiveEmail = { locale: "en", strength: 2 } as const;
const validDate = (value: unknown) => value instanceof Date && Number.isFinite(value.getTime());
const validVersion = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isHash = (value: unknown) => typeof value === "string" && SHA256_HEX.test(value);

export class AdminIntegrityError extends Error {}

export async function adminEmailReserved(email: string) {
  return Boolean(await Admin.exists({ email }).read("primary").collation(insensitiveEmail));
}

export async function ordinaryEmailExists(email: string, session?: ClientSession) {
  return Boolean(await User.exists({ email }).read("primary").collation(insensitiveEmail).session(session ?? null));
}

export async function assertNoLegacyAdmin(session?: ClientSession) {
  // Equality also catches legacy documents with an improperly stored role array.
  if (await User.exists({ role: "admin" }).read("primary").session(session ?? null)) {
    throw new AdminIntegrityError("Legacy administrator in abii.users. Have the database owner review and retire the legacy identity under a separately approved change, then rerun setup.");
  }
}

export async function readAdmin(session?: ClientSession, options: { allowUnreadableFactor?: boolean } = {}): Promise<AdminRecord | null> {
  const rows = await Admin.find().read("primary").session(session ?? null).limit(2)
    .select("+passwordHash +mfa +recoveryCodes +activeSession").lean();
  if (!rows.length) return null;
  const [account] = rows;
  const { mfa, recoveryCodes, status } = account;
  const inconsistent = () => new AdminIntegrityError("Invalid administrator records in abii.admins. Have the database owner review the singleton and its enrollment state.");
  if (rows.length !== 1 || account._id !== ADMIN_ID ||
      typeof account.name !== "string" || !account.name.trim() || account.name.length > 80 ||
      typeof account.email !== "string" || account.email !== normalizeEmail(account.email) ||
      account.email.length > 254 || !ADMIN_EMAIL_PATTERN.test(account.email) ||
      typeof account.passwordHash !== "string" || !ADMIN_PASSWORD_HASH.test(account.passwordHash) ||
      !validVersion(account.sessionVersion) || !validDate(account.createdAt) || !validDate(account.updatedAt) ||
      !mfa || typeof mfa.encryptedSeed !== "string" || !Array.isArray(mfa.completedChallenges) ||
      !Array.isArray(recoveryCodes) || !recoveryCodes.every(isHash)) throw inconsistent();

  const hasChallenge = mfa.challengeHash !== undefined || mfa.challengeVersion !== undefined || mfa.challengeExpiresAt !== undefined;
  if ((hasChallenge && (!isHash(mfa.challengeHash) || !validVersion(mfa.challengeVersion) || !validDate(mfa.challengeExpiresAt))) ||
      mfa.completedChallenges.some(item => !item || !isHash(item.hash) || !validVersion(item.version) || !validDate(item.expiresAt))) {
    throw inconsistent();
  }
  const pending = mfa.lastStep === -1 && isHash(mfa.proofHash) && validDate(mfa.enrollmentExpiresAt) &&
    !hasChallenge && !mfa.completedChallenges.length && !recoveryCodes.length;
  const enrolled = validVersion(mfa.lastStep) && mfa.proofHash === undefined && mfa.enrollmentExpiresAt === undefined &&
    recoveryCodes.length === 8 && new Set(recoveryCodes).size === 8;
  if (!(status === "pending" && pending || status === "active" && enrolled || status === "suspended" && (enrolled || pending))) {
    throw inconsistent();
  }
  if (await ordinaryEmailExists(account.email, session)) {
    throw new AdminIntegrityError("Administrator email also exists in abii.users. Have the database owner resolve the collision under a separately approved change using a dedicated administrator mailbox.");
  }
  if (!options.allowUnreadableFactor) {
    try {
      if (!/^[A-Z2-7]{32}$/.test(readSeed(ADMIN_SUBJECT, mfa.encryptedSeed))) throw inconsistent();
    } catch {
      throw new AdminIntegrityError("Administrator factor cannot be decrypted. Verify the backed-up MFA keyring and enrollment state.");
    }
  }
  return account;
}

export async function readActiveAdmin(session?: ClientSession) {
  await assertNoLegacyAdmin(session);
  const admin = await readAdmin(session);
  return admin?.status === "active" ? admin : null;
}
