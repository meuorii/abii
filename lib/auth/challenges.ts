import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AuthChallenge } from "@/models/AuthChallenge";
import { hashOtp, generateOtp, generateChallengeId } from "./otp-crypto";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { checkAuthRateLimit } from "./rate-limit";

export async function deliverChallenge(userId: string, purpose: "email_verification" | "password_reset", send: (code: string) => Promise<{ ok: boolean }>) {
  await connectToDatabase();
  const account = await User.findById(userId).select("email").lean();
  if (!account) return false;
  const prior = await AuthChallenge.findOne({ userId, purpose }).select("resendAvailableAt").lean() as unknown as { resendAvailableAt: Date } | null;
  if (prior && prior.resendAvailableAt > new Date()) return false;
  if (!(await checkAuthRateLimit("otp-send", account.email, 5, 60 * 60_000))) return false;
  const code = generateOtp(), challengeId = generateChallengeId(), now = new Date();
  const sent = await send(code);
  if (!sent.ok) return false;
  await AuthChallenge.findOneAndUpdate({ userId, purpose }, { $set: { challengeId, codeHash: hashOtp(userId, purpose, challengeId, code), expiresAt: new Date(now.getTime() + 10 * 60_000), resendAvailableAt: new Date(now.getTime() + 60_000), attemptCount: 0, consumedAt: null, lockedAt: null } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return true;
}
export async function consumeChallenge(userId: string, purpose: "email_verification" | "password_reset", code: string) {
  await connectToDatabase();
  const now = new Date();
  const challenge = await AuthChallenge.findOne({ userId, purpose, expiresAt: { $gt: now }, consumedAt: null, lockedAt: null }).select("+codeHash").lean() as unknown as { _id: unknown; challengeId: string; codeHash: string; attemptCount: number } | null;
  if (!challenge || !/^\d{6}$/.test(code)) return false;
  const actual = Buffer.from(hashOtp(userId, purpose, challenge.challengeId, code), "hex"), expected = Buffer.from(challenge.codeHash, "hex");
  const valid = actual.length === expected.length && timingSafeEqual(actual, expected);
  const filter = { _id: challenge._id, challengeId: challenge.challengeId, consumedAt: null, lockedAt: null };
  if (!valid) {
    await AuthChallenge.updateOne({ ...filter, expiresAt: { $gt: now } }, [{ $set: { attemptCount: { $add: [{ $ifNull: ["$attemptCount", 0] }, 1] }, lockedAt: { $cond: [{ $gte: [{ $ifNull: ["$attemptCount", 0] }, 4] }, now, "$lockedAt"] } } }]);
    return false;
  }
  const consumed = await AuthChallenge.findOneAndUpdate({ ...filter, expiresAt: { $gt: now } }, { $set: { consumedAt: now } });
  return !!consumed;
}
export function hashGrant(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function newGrant() { return randomBytes(32).toString("base64url"); }
