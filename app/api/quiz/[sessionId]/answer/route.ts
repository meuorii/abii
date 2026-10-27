import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { submitAnswer } from "@/lib/quiz/service";
import { evaluateAffectedBadges, refreshMasteryMilestones, type NewlyUnlockedBadge } from "@/lib/badges/service";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
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
    const result = await submitAnswer(user._id, sessionId, body);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    let newlyUnlockedBadges: NewlyUnlockedBadge[] = [];
    if (!result.duplicate) {
      try { await refreshMasteryMilestones(String(user._id)); }
      catch (masteryError) { console.error("Answer saved; mastery milestone refresh will retry during reconciliation.", masteryError); }
      try { newlyUnlockedBadges = await evaluateAffectedBadges(String(user._id)); }
      catch (badgeError) { console.error("Answer saved; badge evaluation will retry during reconciliation.", badgeError); }
    }
    return NextResponse.json({ result: result.result, progress: result.progress, mastery: result.mastery, duplicate: result.duplicate, newlyUnlockedBadges });
  } catch (error) {
    console.error("Unable to submit quiz answer.", error);
    return NextResponse.json({ error: "We couldn’t save that answer. Please try again." }, { status: 500 });
  }
}

