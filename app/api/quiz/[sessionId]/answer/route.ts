import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { submitAnswer } from "@/lib/quiz/service";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { sessionId } = await params;

  let body: { questionIndex?: unknown; selectedIndex?: unknown; answer?: unknown; truth?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check your answer and try again." }, { status: 400 });
  }

  try {
    const result = await submitAnswer(user._id, sessionId, body);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    return NextResponse.json({ result: result.result, progress: result.progress });
  } catch (error) {
    console.error("Unable to submit quiz answer.", error);
    return NextResponse.json({ error: "We couldn’t save that answer. Please try again." }, { status: 500 });
  }
}
