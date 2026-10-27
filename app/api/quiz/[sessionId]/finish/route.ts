import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { finishSession, loadSession, sessionMastery, toPublicSession } from "@/lib/quiz/service";
import { evaluateAffectedBadges, type NewlyUnlockedBadge } from "@/lib/badges/service";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { sessionId } = await params;

  try {
    const doc = await loadSession(user._id, sessionId);
    if (!doc) return NextResponse.json({ error: "This quiz session has expired or could not be found." }, { status: 404 });
    const session = toPublicSession(doc, await sessionMastery(user._id, doc));
    return NextResponse.json({ session, summary: session.summary });
  } catch (error) {
    console.error("Unable to reload quiz session.", error);
    return NextResponse.json({ error: "We could not reload this review. Please try again." }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { sessionId } = await params;

  try {
    const result = await finishSession(user._id, sessionId);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    if (!result.done) return NextResponse.json({ retry: true, session: result.session });
    let newlyUnlockedBadges: NewlyUnlockedBadge[] = [];
    try { newlyUnlockedBadges = await evaluateAffectedBadges(String(user._id)); }
    catch (badgeError) { console.error("Quiz completed; badge evaluation will retry during reconciliation.", badgeError); }
    return NextResponse.json({ summary: result.summary, session: result.session, transitioned: result.transitioned, newlyUnlockedBadges });
  } catch (error) {
    console.error("Unable to finish quiz.", error);
    return NextResponse.json({ error: "We couldn’t finish this review. Please try again." }, { status: 500 });
  }
}
