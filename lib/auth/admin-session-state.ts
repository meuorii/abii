import "server-only";
import type { ClientSession } from "mongoose";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_ISSUER } from "./constants";
import { Admin, ADMIN_ID, ADMIN_SUBJECT } from "@/models/Admin";
import { connectToDatabase } from "@/lib/mongodb";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";
import { auditAdmin, recordAdminDenial, requireAdminAuditStorage } from "./admin-audit";
import { ADMIN_LIFETIME, verifyAdminChallenge } from "./admin-factor";
import { readActiveAdmin } from "./admin-identity";

const AUDIENCE = "abii-admin";
export { ADMIN_LIFETIME };
const STEP_UP_AGE = 300;
type AdminClaims = { adminId: typeof ADMIN_SUBJECT; version: number; authenticatedAt: number };
export type AdminAccess = AdminClaims & { name: string };

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

// The only session issuer consumes a password-bound challenge and a fresh factor.
export async function finishAdminLogin(challenge: string, code: string) {
  const key = signingKey();
  const account = await verifyAdminChallenge(challenge, code);
  if (!account) return null;
  const now = account.authenticatedAt;
  return new SignJWT({ sv: account.version, amr: ["pwd", "otp"] })
    .setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" })
    .setAudience(AUDIENCE).setIssuer(SESSION_ISSUER).setSubject(ADMIN_SUBJECT)
    .setIssuedAt(now).setExpirationTime(now + ADMIN_LIFETIME).sign(key);
}

async function readAdminClaims(raw: string): Promise<AdminClaims> {
  const key = signingKey();
  try {
    const { payload, protectedHeader } = await jwtVerify(raw, key, {
      audience: AUDIENCE, issuer: SESSION_ISSUER, algorithms: ["HS256"],
      requiredClaims: ["iat", "exp", "sub", "sv", "amr"],
    });
    const { iat, exp, sv, amr, sub } = payload;
    if (protectedHeader.typ !== "abii-admin+jwt" || payload.aud !== AUDIENCE ||
        sub !== ADMIN_SUBJECT ||
        typeof sv !== "number" || !Number.isSafeInteger(sv) || sv < 0 ||
        typeof iat !== "number" || !Number.isSafeInteger(iat) || iat > Date.now() / 1000 ||
        typeof exp !== "number" || !Number.isSafeInteger(exp) || exp <= iat || exp - iat > ADMIN_LIFETIME ||
        !Array.isArray(amr) || amr.length !== 2 || amr[0] !== "pwd" || amr[1] !== "otp") throw new Error();
    return { adminId: sub, version: sv, authenticatedAt: iat };
  } catch { throw new AdminAccessError(401); }
}

function adminIdentityFilter(actor: AdminClaims) {
  return { status: "active" as const, _id: ADMIN_ID, sessionVersion: actor.version };
}

export async function validateAdminSession(raw: string, fresh = false): Promise<AdminAccess> {
  const actor = await readAdminClaims(raw);
  try {
    await connectToDatabase();
    const account = await readActiveAdmin();
    if (!account || account.sessionVersion !== actor.version) throw new AdminAccessError(401);
    await requireAdminAuditStorage();
    if (fresh && Math.floor(Date.now() / 1000) - actor.authenticatedAt >= STEP_UP_AGE) throw new AdminAccessError(403);
    return { ...actor, name: account.name };
  } catch (error) {
    if (!(error instanceof AdminAccessError)) throw new AdminAccessError(503);
    if (error.status !== 503) await recordAdminDenial("access-denied", error.status === 403 ? actor.adminId : undefined, error.status === 403);
    throw error;
  }
}

export async function revokeAdminSession(raw: string) {
  let actor: AdminClaims;
  try { actor = await readAdminClaims(raw); }
  catch (error) { if (error instanceof AdminAccessError && error.status === 401) return; throw error; }
  await requireAdminAuditStorage();
  return withRequiredTransaction(async session => {
    const updated = await Admin.updateOne({ _id: ADMIN_ID, sessionVersion: actor.version }, { $inc: { sessionVersion: 1 } }, { session });
    if (!updated.modifiedCount) return;
    await auditAdmin("logout", actor.adminId, actor.adminId, session);
    return actor;
  });
}

export async function withFreshAdminMutation<T>(rawAdminCookie: string, operation: (actorId: string, session: ClientSession) => Promise<T>, options: { fresh?: boolean } = {}) {
  const fresh = options.fresh ?? true;
  const actor = await validateAdminSession(rawAdminCookie, fresh);
  return withRequiredTransaction(async session => {
    const now = Math.floor(Date.now() / 1000);
    if (fresh && now - actor.authenticatedAt >= STEP_UP_AGE) throw new AdminAccessError(403);
    // Serialize with concurrent session revocation and credential changes on this identity.
    const account = await readActiveAdmin(session);
    if (!account || account.sessionVersion !== actor.version) throw new AdminAccessError(401);
    const fence = await Admin.updateOne(adminIdentityFilter(actor), { $inc: { mutationVersion: 1 } }, { session });
    if (!fence.modifiedCount) throw new AdminAccessError(401);
    return operation(actor.adminId, session);
  }).catch((error: unknown) => {
    if (error instanceof AdminAccessError) throw error;
    // Domain input/conflict errors are safe for their route boundary to classify.
    if (error instanceof Error && (error.name === "SupportInputError" || error.name === "SupportConflict")) throw error;
    throw new AdminAccessError(503);
  });
}
