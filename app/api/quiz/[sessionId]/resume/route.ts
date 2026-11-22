import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { resumeSession } from "@/lib/quiz/service";

import { withApiPerformanceTrace } from "@/lib/performance/server-timing";

export const runtime = "nodejs";
type Context = { params: Promise<{ sessionId: string }> };
export async function POST(request: Request, { params }: Context) {
  return withApiPerformanceTrace(request, "quiz.resume", async () => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    try {
      const result = await resumeSession(user._id, (await params).sessionId);
      if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
      return NextResponse.json({ sessionId: result.id, expiresAt: result.expiresAt, lastActivityAt: result.lastActivityAt });
    } catch (error) { console.error("Unable to resume quiz.", error); return NextResponse.json({ error: "This quiz could not be resumed. Please try again." }, { status: 500 }); }
  });
}
