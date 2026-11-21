import "server-only";
import type { ClientSession } from "mongoose";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_ISSUER } from "./constants";
import { activeAdminAccount, User } from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";
import { auditAdmin, recordAdminDenial } from "./admin-audit";
import { ADMIN_LIFETIME, hasAdminFactor, verifyAdminChallenge } from "./admin-factor";
import { isSingleAdminIndex } from "./admin-index";

const AUDIENCE = "abii-admin";
export { ADMIN_LIFETIME };
const STEP_UP_AGE = 300;
export type AdminAccess = { userId: string; version: number; authenticatedAt: number };

export class AdminAccessError extends Error {
  constructor(readonly status: 401 | 403 | 503) {
    super(status === 503 ? "Identity service unavailable." : status === 403 ? "Administrator authentication required." : "Sign in again.");
  }
}

function signingKey() {
  const key = process.env.AUTH_SECRET;
  if (!key || key.length < 32) throw new AdminAccessError(503);
  return new TextEncoder().encode(key);
}

async function requireSingleAdminIndex() {
  const { connection } = await connectToDatabase();
  const indexes = await connection.db?.collection(User.collection.name).indexes({ readPreference: "primary" });
  if (!indexes?.some(isSingleAdminIndex)) throw new AdminAccessError(503);
}

// The only session issuer consumes a password-bound challenge and a fresh factor.
export async function finishAdminLogin(challenge: string, code: string) {
  const key = signingKey();
  await requireSingleAdminIndex();
  const account = await verifyAdminChallenge(challenge, code);
  if (!account) return null;
  const now = account.authenticatedAt;
  return new SignJWT({ sv: account.version, amr: ["pwd", "otp"] })
    .setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" })
    .setAudience(AUDIENCE).setIssuer(SESSION_ISSUER).setSubject(account.userId)
    .setIssuedAt(now).setExpirationTime(now + ADMIN_LIFETIME).sign(key);
}

async function readAdminClaims(raw: string): Promise<AdminAccess> {
  const key = signingKey();
  try {
    const { payload, protectedHeader } = await jwtVerify(raw, key, {
      audience: AUDIENCE, issuer: SESSION_ISSUER, algorithms: ["HS256"],
      requiredClaims: ["iat", "exp", "sub", "sv", "amr"],
    });
    const { iat, exp, sv, amr, sub } = payload;
    if (protectedHeader.typ !== "abii-admin+jwt" || payload.aud !== AUDIENCE ||
        typeof sub !== "string" || !/^[0-9a-f]{24}$/.test(sub) ||
        typeof sv !== "number" || !Number.isSafeInteger(sv) || sv < 0 ||
        typeof iat !== "number" || !Number.isSafeInteger(iat) || iat > Date.now() / 1000 ||
        typeof exp !== "number" || !Number.isSafeInteger(exp) || exp <= iat || exp - iat > ADMIN_LIFETIME ||
        !Array.isArray(amr) || amr.length !== 2 || amr[0] !== "pwd" || amr[1] !== "otp") throw new Error();
    return { userId: sub, version: sv, authenticatedAt: iat };
  } catch { throw new AdminAccessError(401); }
}

export function adminIdentityFilter(actor: AdminAccess) {
  return { ...activeAdminAccount, _id: actor.userId, sessionVersion: actor.version };
}

export async function validateAdminSession(raw: string, fresh = false): Promise<AdminAccess> {
  const actor = await readAdminClaims(raw);
  try {
    await requireSingleAdminIndex();
    if (!await User.exists(adminIdentityFilter(actor)).read("primary") || !await hasAdminFactor(actor.userId)) throw new AdminAccessError(401);
    if (fresh && Math.floor(Date.now() / 1000) - actor.authenticatedAt >= STEP_UP_AGE) throw new AdminAccessError(403);
    return actor;
  } catch (error) {
    if (!(error instanceof AdminAccessError)) throw new AdminAccessError(503);
    if (error.status !== 503) await recordAdminDenial("access-denied", actor.userId);
    throw error;
  }
}

export async function revokeAdminSession(raw: string) {
  let actor: AdminAccess;
  try { actor = await readAdminClaims(raw); }
  catch (error) { if (error instanceof AdminAccessError && error.status === 401) return; throw error; }
  await connectToDatabase();
  return withRequiredTransaction(async session => {
    const updated = await User.updateOne(adminIdentityFilter(actor), { $inc: { sessionVersion: 1 } }, { session });
    if (!updated.modifiedCount) return;
    await auditAdmin("logout", actor.userId, actor.userId, session);
    return actor;
  });
}

export async function withFreshAdminMutation<T>(rawAdminCookie: string, operation: (actorId: string, session: ClientSession) => Promise<T>) {
  const actor = await validateAdminSession(rawAdminCookie, true);
  return withRequiredTransaction(async session => {
    const now = Math.floor(Date.now() / 1000);
    if (now - actor.authenticatedAt >= STEP_UP_AGE) throw new AdminAccessError(403);
    // Serialize with concurrent session revocation and credential changes on this identity.
    const fence = await User.updateOne(adminIdentityFilter(actor), { $inc: { adminMutationVersion: 1 } }, { session });
    if (!fence.modifiedCount) throw new AdminAccessError(401);
    return operation(actor.userId, session);
  }).catch((error: unknown) => {
    if (error instanceof AdminAccessError) throw error;
    throw new AdminAccessError(503);
  });
}
