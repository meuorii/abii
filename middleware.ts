import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "abii_session";
function secret() {
  const value = process.env.AUTH_SECRET;
  return value && value.length >= 32 ? new TextEncoder().encode(value) : null;
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const key = secret();
  let valid = false;
  if (token && key) {
    try {
      await jwtVerify(token, key, { algorithms: ["HS256"], issuer: "abii", audience: "abii-web" });
      valid = true;
    } catch { valid = false; }
  }
  if (!valid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    const response = NextResponse.redirect(loginUrl);
    if (token) response.cookies.delete(COOKIE_NAME);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/subjects/:path*", "/review/:path*", "/settings/:path*"],
};
