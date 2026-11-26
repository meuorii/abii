import "server-only";
import type { ClientSession } from "mongoose";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_ISSUER } from "./constants";
import { ADMIN_FRESH_AUTH_SECONDS, ADMIN_INACTIVITY_TIMEOUT_SECONDS, ADMIN_SESSION_LIFETIME_SECONDS } from "./constants";
import { Admin, ADMIN_ID, ADMIN_SUBJECT } from "@/models/Admin";
import { connectToDatabase } from "@/lib/mongodb";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";
import { auditAdmin, recordAdminDenial, requireAdminAuditStorage } from "./admin-audit";
import { verifyAdminChallenge } from "./admin-factor";
import { readActiveAdmin } from "./admin-identity";

const AUDIENCE = "abii-admin";
export const ADMIN_LIFETIME = ADMIN_SESSION_LIFETIME_SECONDS;
type AdminClaims = { adminId: typeof ADMIN_SUBJECT; version: number; authenticatedAt: number; sessionId: string; environment: "development" | "production" };
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
  return new SignJWT({ sv: account.version, sid: account.sessionId, env: account.environment, amr: ["pwd", "otp"] })
    .setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" })
    .setAudience(AUDIENCE).setIssuer(SESSION_ISSUER).setSubject(ADMIN_SUBJECT)
    .setIssuedAt(now).setExpirationTime(now + ADMIN_LIFETIME).sign(key);
}

async function readAdminClaims(raw: string): Promise<AdminClaims> {
  const key = signingKey();
  const expectedEnvironment = process.env.NODE_ENV === "production" ? "production" : "development";
  try {
    const { payload, protectedHeader } = await jwtVerify(raw, key, {
      audience: AUDIENCE, issuer: SESSION_ISSUER, algorithms: ["HS256"],
      requiredClaims: ["iat", "exp", "sub", "sv", "sid", "env", "amr"],
    });
    const { iat, exp, sv, sid, env, amr, sub } = payload;
    if (protectedHeader.typ !== "abii-admin+jwt" || payload.aud !== AUDIENCE ||
        sub !== ADMIN_SUBJECT ||
        typeof sv !== "number" || !Number.isSafeInteger(sv) || sv < 0 ||
        typeof iat !== "number" || !Number.isSafeInteger(iat) || iat > Date.now() / 1000 ||
        typeof exp !== "number" || !Number.isSafeInteger(exp) || exp <= iat || exp - iat !== ADMIN_LIFETIME ||
        typeof sid !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(sid) ||
        env !== expectedEnvironment ||
        !Array.isArray(amr) || amr.length !== 2 || amr[0] !== "pwd" || amr[1] !== "otp") throw new Error();
    return { adminId: sub, version: sv, authenticatedAt: iat, sessionId: sid, environment: expectedEnvironment };
  } catch { throw new AdminAccessError(401); }
}

function adminIdentityFilter(actor: AdminClaims) {
  return { status: "active" as const, _id: ADMIN_ID, sessionVersion: actor.version, "activeSession.sessionId": actor.sessionId };
}

export async function validateAdminSession(raw: string, fresh = false): Promise<AdminAccess> {
  const actor = await readAdminClaims(raw);
  try {
    await connectToDatabase();
    const account = await readActiveAdmin();
    const active = account?.activeSession;
    const now = Date.now();
    if (!account || account.sessionVersion !== actor.version || !active || active.sessionId !== actor.sessionId ||
        active.version !== actor.version || active.environment !== actor.environment ||
        active.authenticatedAt.getTime() !== actor.authenticatedAt * 1000 ||
        active.absoluteExpiresAt.getTime() !== actor.authenticatedAt * 1000 + ADMIN_SESSION_LIFETIME_SECONDS * 1000 ||
        active.absoluteExpiresAt.getTime() <= now || active.lastActivityAt.getTime() + ADMIN_INACTIVITY_TIMEOUT_SECONDS * 1000 <= now) throw new AdminAccessError(401);
    await requireAdminAuditStorage();
    if (fresh && Math.floor(Date.now() / 1000) - actor.authenticatedAt >= ADMIN_FRESH_AUTH_SECONDS) throw new AdminAccessError(403);
    return { ...actor, name: account.name };
  } catch (error) {
    if (!(error instanceof AdminAccessError)) throw new AdminAccessError(503);
    if (error.status !== 503) await recordAdminDenial("access-denied", error.status === 403 ? actor.adminId : undefined, error.status === 403);
    throw error;
  }
}

export async function getAdminSessionSnapshot(raw: string) {
  const actor = await validateAdminSession(raw);
  try {
    const account = await readActiveAdmin();
    const active = account?.activeSession;
    if (!active || active.sessionId !== actor.sessionId || active.version !== actor.version || active.environment !== actor.environment ||
        active.authenticatedAt.getTime() !== actor.authenticatedAt * 1000) throw new AdminAccessError(401);
    return {
      serverNow: Date.now(),
      authenticatedAt: active.authenticatedAt.getTime(),
      absoluteExpiresAt: active.absoluteExpiresAt.getTime(),
      lastActivityAt: active.lastActivityAt.getTime(),
      inactivityExpiresAt: active.lastActivityAt.getTime() + ADMIN_INACTIVITY_TIMEOUT_SECONDS * 1000,
      freshExpiresAt: active.authenticatedAt.getTime() + ADMIN_FRESH_AUTH_SECONDS * 1000,
      sessionLifetimeSeconds: ADMIN_SESSION_LIFETIME_SECONDS,
      inactivityTimeoutSeconds: ADMIN_INACTIVITY_TIMEOUT_SECONDS,
      freshAuthenticationSeconds: ADMIN_FRESH_AUTH_SECONDS,
      mfaVerified: true,
    };
  } catch (error) {
    if (error instanceof AdminAccessError) throw error;
    throw new AdminAccessError(503);
  }
}

export async function recordAdminActivity(raw: string) {
  const actor = await readAdminClaims(raw);
  const now = new Date();
  const notExpiredAt = new Date(now.getTime() - ADMIN_INACTIVITY_TIMEOUT_SECONDS * 1000);
  const writeAfter = new Date(now.getTime() - 120_000);
  const sessionFilter = {
    ...adminIdentityFilter(actor),
    "activeSession.environment": actor.environment,
    "activeSession.authenticatedAt": new Date(actor.authenticatedAt * 1000),
    "activeSession.absoluteExpiresAt": { $gt: now },
    "activeSession.lastActivityAt": { $gt: notExpiredAt },
  };
  try {
    await connectToDatabase();
    const active = await Admin.findOne(sessionFilter).select("+activeSession").read("primary").lean();
    if (!active?.activeSession) throw new AdminAccessError(401);
    if (active.activeSession.lastActivityAt > writeAfter) return;
    const changed = await Admin.updateOne({ ...sessionFilter, "activeSession.lastActivityAt": active.activeSession.lastActivityAt },
      { $max: { "activeSession.lastActivityAt": now } });
    if (!changed.matchedCount) {
      const stillActive = await Admin.exists(sessionFilter).read("primary");
      if (!stillActive) throw new AdminAccessError(401);
    }
  } catch (error) {
    if (error instanceof AdminAccessError) throw error;
    throw new AdminAccessError(503);
  }
}

export async function revokeAdminSession(raw: string) {
  let actor: AdminClaims;
  try { actor = await readAdminClaims(raw); }
  catch (error) { if (error instanceof AdminAccessError && error.status === 401) return; throw error; }
  await requireAdminAuditStorage();
  return withRequiredTransaction(async session => {
    const updated = await Admin.updateOne(adminIdentityFilter(actor), { $inc: { sessionVersion: 1 }, $unset: { activeSession: 1 } }, { session });
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
    if (fresh && now - actor.authenticatedAt >= ADMIN_FRESH_AUTH_SECONDS) throw new AdminAccessError(403);
    // Serialize with concurrent session revocation and credential changes on this identity.
    const account = await readActiveAdmin(session);
    if (!account || account.sessionVersion !== actor.version || account.activeSession?.sessionId !== actor.sessionId) throw new AdminAccessError(401);
    const fence = await Admin.updateOne(adminIdentityFilter(actor), { $inc: { mutationVersion: 1 } }, { session });
    if (!fence.modifiedCount) throw new AdminAccessError(401);
    return operation(actor.adminId, session);
  }).catch((error: unknown) => {
    if (error instanceof AdminAccessError) throw error;
    // Domain input/conflict errors are safe for their route boundary to classify.
    if (error instanceof Error && (error.name === "SupportInputError" || error.name === "SupportConflict" || error.name === "SettingsInputError" || error.name === "SettingsConflict" || error.name === "SettingsRateLimitError")) throw error;
    throw new AdminAccessError(503);
  });
}
