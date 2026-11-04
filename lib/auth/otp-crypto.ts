import "server-only";
import { createHmac, randomInt, randomUUID } from "node:crypto";

export function generateOtp() { return randomInt(0, 1_000_000).toString().padStart(6, "0"); }
export function generateChallengeId() { return randomUUID(); }
export function hashOtp(userId: string, purpose: "email_verification" | "password_reset", challengeId: string, code: string) {
  const secret = process.env.AUTH_OTP_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_OTP_SECRET must contain at least 32 characters.");
  return createHmac("sha256", secret).update(JSON.stringify([userId, purpose, challengeId, code])).digest("hex");
}
