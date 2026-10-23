import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_AUDIENCE, SESSION_COOKIE, SESSION_COOKIE_OPTIONS, SESSION_ISSUER } from "@/lib/auth/constants";
import { safeNextPath } from "@/lib/auth/redirect";
function secret() {
  const value = process.env.AUTH_SECRET;
  return value && value.length >= 32 ? new TextEncoder().encode(value) : null;
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const key = secret();
  let valid = false;
  if (token && key) {
    try {
      await jwtVerify(token, key, { algorithms: ["HS256"], issuer: SESSION_ISSUER, audience: SESSION_AUDIENCE });
      valid = true;
    } catch { valid = false; }
  }
  if (!valid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", safeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`));
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    if (token) response.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) });
    return response;
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/subjects/:path*",
    "/review/:path*",
    "/progress/:path*",
    "/profile/:path*",
    "/settings/:path*",
  ],
};
