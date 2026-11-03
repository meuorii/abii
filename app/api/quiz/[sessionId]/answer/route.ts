import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { submitAnswer } from "@/lib/quiz/service";
import { logServerDuration, measureServerOperation } from "@/lib/performance/server-timing";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const startedAt = performance.now();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { sessionId } = await params;

  let body: { questionIndex?: unknown; selectedIndex?: unknown; answer?: unknown; answers?: unknown; truth?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check your answer and try again." }, { status: 400 });
  }

  try {
    const result = await measureServerOperation("answer processing", () => submitAnswer(user._id, sessionId, body));
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    const response = NextResponse.json({ result: result.result, progress: result.progress, mastery: result.mastery, duplicate: result.duplicate, newlyUnlockedBadges: [] });
    logServerDuration("total answer API", startedAt);
    return response;
  } catch (error) {
    console.error("Unable to submit quiz answer.", error);
    return NextResponse.json({ error: "We couldn’t save that answer. Please try again." }, { status: 500 });
  }
}

