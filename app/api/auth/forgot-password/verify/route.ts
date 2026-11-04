import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { AuthChallenge } from "@/models/AuthChallenge";
import { PasswordResetGrant } from "@/models/PasswordResetGrant";
import { consumeChallenge } from "@/lib/auth/challenges";
import { newGrant, hashGrant } from "@/lib/auth/challenges";
import { setResetGrantCookie } from "@/lib/auth/tickets";
import { normalizeEmail } from "@/lib/auth/validation";
import { limited, rateAllowed, rateAllowedByTrustedIp, validOrigin } from "@/lib/auth/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  let body: { email?: unknown; code?: unknown }; try { body = await request.json(); } catch { body = {}; }
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "", code = typeof body.code === "string" ? body.code : "";
  if (!(await rateAllowed("recovery-verify", email || "invalid", 10, 60 * 60_000))) return limited();
  if (!(await rateAllowedByTrustedIp(request, "recovery-verify-ip", 30, 60 * 60_000))) return limited();
  await connectToDatabase();
  const user = await User.findOne({ email }).select("_id").lean();
  if (!user || !(await consumeChallenge(String(user._id), "password_reset", code))) return NextResponse.json({ message: "The recovery code is incorrect or expired." }, { status: 400 });
  const raw = newGrant();
  await PasswordResetGrant.create({ userId: user._id, tokenHash: hashGrant(raw), expiresAt: new Date(Date.now() + 5 * 60_000) });
  // The random grant is carried only inside a signed HttpOnly cookie.
  await setResetGrantCookie(raw);
  await AuthChallenge.deleteMany({ userId: user._id, purpose: "password_reset" });
  return NextResponse.json({ message: "Code verified." });
}
