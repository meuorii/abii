import "server-only";
import { NextResponse } from "next/server";
import { checkAuthRateLimit } from "./rate-limit";
export function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(process.env.APP_BASE_URL || request.url).origin; } catch { return false; }
}
export async function rateAllowed(scope: string, identity: string, limit: number, windowMs: number) {
  return checkAuthRateLimit(scope, identity, limit, windowMs);
}
export async function rateAllowedByTrustedIp(request: Request, scope: string, limit: number, windowMs: number) {
  const header = process.env.TRUSTED_PROXY_IP_HEADER;
  if (header !== "x-real-ip" && header !== "cf-connecting-ip") return true;
  const value = request.headers.get(header)?.trim();
  if (!value || value.length > 64 || !/^[0-9a-fA-F:.]+$/.test(value)) return false;
  return rateAllowed(scope, value, limit, windowMs);
}
export function limited() { return NextResponse.json({ message: "Too many attempts. Please wait and try again." }, { status: 429 }); }
