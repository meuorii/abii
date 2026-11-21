import "server-only";
import { NextResponse } from "next/server";

export function trustedAdminOrigin(request: Request): boolean {
  const base = process.env.APP_BASE_URL;
  if (!base || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const url = new URL(base);
    return (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:")) &&
      request.headers.get("origin") === url.origin;
  } catch { return false; }
}

export function privateJson(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
