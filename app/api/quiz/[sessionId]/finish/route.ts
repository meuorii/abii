import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { finishSession, loadSession, sessionMastery, toPublicSession } from "@/lib/quiz/service";
import { evaluateAffectedBadges, type NewlyUnlockedBadge } from "@/lib/badges/service";
import { measureServerOperation, withApiPerformanceTrace } from "@/lib/performance/server-timing";
import { notifyQuizMilestoneForCompletion } from "@/lib/notifications/producers";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  return withApiPerformanceTrace(request, "quiz.session.load", async () => {
    const user = await getCurrentUser();
    if (!user) return measureServerOperation("response serialization", async () => NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }));
    const { sessionId } = await params;
    try {
      const doc = await loadSession(user._id, sessionId);
      if (!doc) return measureServerOperation("response serialization", async () => NextResponse.json({ error: "This quiz session has expired or could not be found." }, { status: 404 }));
      const session = toPublicSession(doc, await sessionMastery(user._id, doc));
      return measureServerOperation("response serialization", async () => NextResponse.json({ session, summary: session.summary }));
    } catch (error) {
      console.error("Unable to reload quiz session.", error);
      return measureServerOperation("response serialization", async () => NextResponse.json({ error: "We could not reload this review. Please try again." }, { status: 500 }));
    }
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  return withApiPerformanceTrace(request, "quiz.finish", async () => {
    const user = await getCurrentUser();
    if (!user) return measureServerOperation("response serialization", async () => NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }));
    const { sessionId } = await params;
    try {
      const result = await measureServerOperation("finish session processing", () => finishSession(user._id, sessionId, user.settings?.studyTimezone));
      if (!result.ok) return measureServerOperation("response serialization", async () => NextResponse.json({ error: result.message }, { status: result.status }));
      if (!result.done) return measureServerOperation("response serialization", async () => NextResponse.json({ retry: true, session: result.session }));
      if (result.transitioned) {
        // The session transition is authoritative. Producer failures must not change the quiz result.
        try { await notifyQuizMilestoneForCompletion(String(user._id), sessionId); }
        catch (notificationError) { console.error("Quiz completed; milestone notification could not be recorded.", notificationError instanceof Error ? notificationError.name : "UnknownError"); }
      }
      let newlyUnlockedBadges: NewlyUnlockedBadge[] = [];
      try { newlyUnlockedBadges = await measureServerOperation("affected badge evaluation", () => evaluateAffectedBadges(String(user._id))); }
      catch (badgeError) { console.error("Quiz completed; badge evaluation will retry during reconciliation.", badgeError); }
      return measureServerOperation("response serialization", async () => NextResponse.json({ summary: result.summary, session: result.session, transitioned: result.transitioned, newlyUnlockedBadges }));
    } catch (error) {
      console.error("Unable to finish quiz.", error);
      return measureServerOperation("response serialization", async () => NextResponse.json({ error: "We couldn't finish this review. Please try again." }, { status: 500 }));
    }
  });
}
