import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";

export const SESSION_COOKIE = "abii_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

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
    .setIssuer("abii")
    .setAudience("abii-web")
    .sign(getSessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
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
      issuer: "abii",
      audience: "abii-web",
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const userId = await readSessionUserId();
  if (!userId) return null;
  await connectToDatabase();
  return User.findById(userId).select("name email createdAt").lean();
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
