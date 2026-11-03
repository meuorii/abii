import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { submitAnswer } from "@/lib/quiz/service";
import { measureServerOperation, withApiPerformanceTrace } from "@/lib/performance/server-timing";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  return withApiPerformanceTrace(request, "quiz.answer", async () => {
    const user = await getCurrentUser();
    if (!user) return measureServerOperation("response serialization", async () => NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }));
    const { sessionId } = await params;

    let body: { questionIndex?: unknown; selectedIndex?: unknown; answer?: unknown; answers?: unknown; truth?: unknown };
    try {
      body = await request.json();
    } catch {
      return measureServerOperation("response serialization", async () => NextResponse.json({ error: "Please check your answer and try again." }, { status: 400 }));
    }

    try {
      const result = await measureServerOperation("answer processing", () => submitAnswer(user._id, sessionId, body, user.settings?.studyTimezone));
      if (!result.ok) return measureServerOperation("response serialization", async () => NextResponse.json({ error: result.message }, { status: result.status }));
      return measureServerOperation("response serialization", async () => NextResponse.json({ result: result.result, progress: result.progress, mastery: result.mastery, duplicate: result.duplicate, newlyUnlockedBadges: [] }));
    } catch (error) {
      console.error("Unable to submit quiz answer.", error);
      return measureServerOperation("response serialization", async () => NextResponse.json({ error: "We couldn't save that answer. Please try again." }, { status: 500 }));
    }
  });
}
