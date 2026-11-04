import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";
import { measureServerOperation } from "@/lib/performance/server-timing";
import { SESSION_AUDIENCE, SESSION_COOKIE, SESSION_COOKIE_OPTIONS, SESSION_DURATION_SECONDS, SESSION_ISSUER } from "@/lib/auth/constants";

export { SESSION_COOKIE, SESSION_DURATION_SECONDS } from "@/lib/auth/constants";

function getSessionSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random value of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string): Promise<void> {
  await connectToDatabase();
  const account = await User.findById(userId).select("emailVerifiedAt sessionVersion").lean();
  if (!account || !(account.emailVerifiedAt instanceof Date) || !Number.isFinite(account.emailVerifiedAt.getTime())) throw new Error("Email verification is required before signing in.");
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ sv: account.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_DURATION_SECONDS)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .sign(getSessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function readSessionUserId(token?: string): Promise<string | null> {
  let sessionToken = token;
  if (sessionToken === undefined) {
    const cookieStore = await cookies();
    sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  }
  if (!sessionToken) return null;

  try {
    const { payload } = await measureServerOperation("JWT verification", () => jwtVerify(sessionToken!, getSessionSecret(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    }));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async function getCurrentUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const userId = await measureServerOperation("authentication lookup", readSessionUserId);
  if (!userId) return null;
  await measureServerOperation("authentication database connection", connectToDatabase);
  let claims: { sv?: unknown };
  try { claims = (await jwtVerify(raw!, getSessionSecret(), { algorithms: ["HS256"], issuer: SESSION_ISSUER, audience: SESSION_AUDIENCE })).payload as { sv?: unknown }; } catch { return null; }
  const user = await measureServerOperation("user lookup", () => User.findById(userId).select("name email createdAt profileImage settings.studyTimezone emailVerifiedAt sessionVersion").lean(), { database: true });
  // Pre-rollout signed sessions omitted `sv`; they remain valid at version zero
  // for already verified accounts. Unverified accounts still fail this guard.
  if (!user || !(user.emailVerifiedAt instanceof Date) || !Number.isFinite(user.emailVerifiedAt.getTime()) || (claims.sv ?? 0) !== (user.sessionVersion ?? 0)) return null;
  return user;
});

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
}
