import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { clearAuthFlowCookies } from "@/lib/auth/tickets";

export async function POST() {
  await destroySession();
  await clearAuthFlowCookies();
  return NextResponse.json({ message: "Signed out." });
}
