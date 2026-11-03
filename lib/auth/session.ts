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
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({})
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
    const { payload } = await jwtVerify(sessionToken, getSessionSecret(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async function getCurrentUser() {
  const userId = await measureServerOperation("authentication lookup", readSessionUserId);
  if (!userId) return null;
  await measureServerOperation("authentication database connection", connectToDatabase);
  return measureServerOperation("authentication user query", () => User.findById(userId).select("name email createdAt profileImage").lean());
});

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
}
