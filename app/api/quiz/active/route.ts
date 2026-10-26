import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listActiveSessions } from "@/lib/quiz/service";

export const runtime = "nodejs";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  try { return NextResponse.json({ sessions: await listActiveSessions(user._id) }); }
  catch (error) { console.error("Unable to list active quizzes.", error); return NextResponse.json({ error: "Active quizzes could not be loaded. Please try again." }, { status: 500 }); }
}
