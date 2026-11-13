import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { startSession } from "@/lib/quiz/service";
import { measureServerOperation, withApiPerformanceTrace } from "@/lib/performance/server-timing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withApiPerformanceTrace(request, "quiz.start", async () => {
    const user = await getCurrentUser();
    if (!user) return measureServerOperation("response serialization", async () => NextResponse.json({ error: "Please sign in to start a quiz." }, { status: 401 }));

    let body: { scope?: unknown; subjectId?: unknown; topicId?: unknown; type?: unknown; reviewFilter?: unknown };
    try {
      body = await request.json();
    } catch {
      return measureServerOperation("response serialization", async () => NextResponse.json({ error: "Please check your selection and try again." }, { status: 400 }));
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return measureServerOperation("response serialization", async () => NextResponse.json({ error: "Please check your selection and try again." }, { status: 400 }));

    try {
      const result = await startSession(user._id, body);
      if (!result.ok) return measureServerOperation("response serialization", async () => NextResponse.json({ error: result.message }, { status: result.status }));
      return measureServerOperation("response serialization", async () => NextResponse.json({ sessionId: result.sessionId, total: result.total }, { status: 201 }));
    } catch (error) {
      console.error("Unable to start quiz.", error);
      return measureServerOperation("response serialization", async () => NextResponse.json({ error: "We couldn't start your quiz. Please try again." }, { status: 500 }));
    }
  });
}
