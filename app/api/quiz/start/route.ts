import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { startSession } from "@/lib/quiz/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to start a quiz." }, { status: 401 });

  let body: { subjectId?: unknown; type?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check your selection and try again." }, { status: 400 });
  }

  try {
    const result = await startSession(user._id, body.subjectId, body.type);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    return NextResponse.json({ sessionId: result.sessionId, total: result.total }, { status: 201 });
  } catch (error) {
    console.error("Unable to start quiz.", error);
    return NextResponse.json({ error: "We couldn’t start your quiz. Please try again." }, { status: 500 });
  }
}
