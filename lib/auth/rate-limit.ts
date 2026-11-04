import "server-only";
import { createHmac } from "node:crypto";
import { AuthRateLimit } from "@/models/AuthRateLimit";
import { connectToDatabase } from "@/lib/mongodb";

/** Persistent fixed-window counter. Caller must choose scope and a trusted client address. */
export async function checkAuthRateLimit(scope: string, identity: string, limit: number, windowMs: number): Promise<boolean> {
  const secret = process.env.AUTH_OTP_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_OTP_SECRET must contain at least 32 characters.");
  const key = createHmac("sha256", secret).update(JSON.stringify([scope, identity])).digest("hex");
  const window = Math.floor(Date.now() / windowMs);
  await connectToDatabase();
  // A unique key and atomic increment count concurrent requests, including requests over the limit.
  try {
    const result = await AuthRateLimit.findOneAndUpdate({ key, window }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * windowMs) } }, { upsert: true, new: true });
    return result.count <= limit;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
    const result = await AuthRateLimit.findOneAndUpdate({ key, window }, { $inc: { count: 1 } }, { new: true });
    return !!result && result.count <= limit;
  }
}
